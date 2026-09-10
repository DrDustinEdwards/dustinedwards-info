/**
 * One command that ships: gates, deploy, prove it, sync.
 *
 *   npm run ship
 *
 * OBSERVATION BOUNDARY: this runs the steps and reads their output. It does not
 * know whether a gate is meaningful, and it proves the deploy by POLLING rather
 * than by inspecting the built bundle, so a build that succeeded and shipped the
 * wrong thing looks identical here. Proving WHICH build answered is
 * `verify-live`'s job and is deliberately not folded in: it bills money per Ask
 * probe and must stay a decision, not a side effect.
 *
 * ## THE TWO ORDERING RULES, AND WHY THIS FILE IS NOW WHERE THEY LIVE
 *
 * Both were carried in session prompts six times before this existed. A rule
 * that survives only because someone remembers to type it is not a rule, and
 * the cost of getting either wrong is paid by readers rather than by the person
 * shipping.
 *
 * **1. DEPLOY BEFORE SYNC.** `sync:content --remote` writes the corpus and
 * `llms.txt` into D1, and `llms.txt` advertises URLs. Sync first and the index
 * plus the machine-readable manifest describe pages the running Worker does not
 * serve yet, so every agent that reads `llms.txt` in that window gets a 404 on
 * a URL the site told it to fetch. Deploying first means the worst case is a
 * page that exists and is not yet indexed, which is invisible.
 *
 * **2. `check:content` BEFORE SYNC, EXPLICITLY.** `sync-content.mjs` RUNS NO
 * GATE. Its own header says so in capitals, and it says so because it once
 * implied the opposite. It is the largest write path into production D1 in the
 * repo, and it will happily push a stale or hand-edited artifact. The gate is
 * three seconds; the failure is a corpus that disagrees with the repo and is
 * only found by a byte comparison nobody runs until the next build.
 *
 * ## FAIL CLOSED AT EVERY STEP
 *
 * A dirty tree refuses before building. A red gate refuses to deploy. A failed
 * poll refuses to sync. Each refusal names the step and what to do.
 *
 * The dirty-tree refusal is the one that has actually been needed. **`npm run
 * deploy` builds from the WORKING TREE, not from HEAD**, so a deploy with
 * uncommitted files ships code that exists on no commit and that no clone can
 * reproduce. That happened on 2026-08-07 and ran in production for two days
 * before anyone noticed, because every instrument in the repo reported health.
 *
 * ## A SHIP THAT CANNOT PROVE WHAT IT SHIPPED DID NOT SHIP
 *
 * The Version ID and the sync line are both parsed out of the real output and
 * printed at the end. If either is missing this exits nonzero even when every
 * command succeeded, because "it seemed to work" is not a deploy record.
 */

import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ciVerdict, fetchCiRuns } from "./lib/ci-status.mjs";
import { applyCommand, readMigrationList } from "./lib/pending-migrations.mjs";
import { SITE_ORIGIN } from "../app/lib/seo.ts";
import {
  DEFERRED_CHECKS,
  deferredMisses,
  readinessLines,
  readinessVerdict,
} from "./lib/readiness.mjs";
import { retryRead } from "./lib/retry.mjs";
import {
  ASK_POLL_INTERVAL_MS,
  ASK_POLL_WINDOW_MS,
  awaitAskConvergence,
} from "./lib/ask-converge.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------ ship's own transcript --- */

/**
 * Where the transcript goes. GITIGNORED, and `.gitignore` carries the two
 * independent reasons: ship refuses a dirty tree, so an untracked log it wrote
 * itself would make the next ship refuse because of the last one; and the log
 * carries the account-scoped ids wrangler prints in its binding table.
 */
const LOG_DIR = join(root, ".ship-logs");

/**
 * PRUNED BY AGE, NEVER BY COUNT.
 *
 * A count is only a duration if the write rate is fixed, and ship's is not: a
 * bad afternoon writes a dozen runs and a quiet fortnight writes none, so
 * "keep the last twenty" is two weeks in one case and one afternoon in the
 * other, and it is the afternoon that deletes the log somebody wanted. Fourteen
 * days is long enough that a Monday can still read the previous Monday's
 * refusal.
 */
const LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Ship writes its own transcript, every run, pass or fail.
 *
 * ## WHY THIS IS A RE-EXEC AND NOT A WRAPPER AROUND `console`
 *
 * Almost everything a person needs from a failed ship is printed by a CHILD
 * rather than by this file: the gate tier, the build, wrangler. `run()` hands
 * those children `stdio: "inherit"` so their output streams live, which means
 * this process never sees the bytes and cannot write them anywhere. Capturing
 * them instead would buy the log at the price of a seven-minute silence during
 * the gate tier, which is the span somebody is most likely to be watching.
 *
 * So the first invocation re-execs itself with stdout and stderr piped, and
 * forwards every chunk to the real stream AND to the file as it arrives.
 * Liveness survives because the forwarding streams; grandchildren are captured
 * because they inherit the pipe rather than the terminal.
 *
 * ## WHY IT HAD TO EXIST
 *
 * The evidence survived only when whoever ran ship remembered to pipe it. Three
 * sessions running diagnosed a refusal out of a log that existed by luck, and
 * one of those refusals named a gate whose failing test name had already been
 * thrown away upstream. A record that depends on being remembered is not a
 * record, and this is the same argument the two ordering rules above make about
 * rules carried in session prompts.
 *
 * ## THE BOUNDARY
 *
 * It records what ship and its children PRINTED. It is not a deploy record and
 * proves nothing about the running Worker; that is still `verify-live`'s job.
 * And a parent killed by the host may leave the child running, which the signal
 * forwarding below reduces and does not eliminate: a killed ship was always
 * able to leave work in flight, and this does not change that either way.
 *
 * @returns {Promise<number>} the child's exit code
 */
async function teeSelfToLog() {
  mkdirSync(LOG_DIR, { recursive: true });

  const now = Date.now();
  for (const entry of readdirSync(LOG_DIR)) {
    if (!entry.startsWith("ship-") || !entry.endsWith(".log")) continue;
    const full = join(LOG_DIR, entry);
    try {
      if (now - statSync(full).mtimeMs > LOG_MAX_AGE_MS) rmSync(full, { force: true });
    } catch {
      /* a log that vanished under us needs no pruning */
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = join(LOG_DIR, `ship-${stamp}.log`);
  const handle = openSync(logPath, "a");

  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, SHIP_TRANSCRIPT: logPath },
    stdio: ["inherit", "pipe", "pipe"],
  });

  /** @param {import("node:stream").Readable} source @param {NodeJS.WriteStream} sink */
  const forward = (source, sink) => {
    source.on("data", (chunk) => {
      sink.write(chunk);
      writeSync(handle, chunk);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  for (const signal of /** @type {NodeJS.Signals[]} */ (["SIGINT", "SIGTERM"])) {
    process.on(signal, () => {
      try {
        child.kill(signal);
      } catch {
        /* already gone */
      }
    });
  }

  const code = await new Promise((resolve) => {
    child.on("exit", (status) => resolve(status ?? 1));
    child.on("error", () => resolve(1));
  });

  /*
   * THE PATH IS THE LAST THING PRINTED ON A FAILURE, deliberately after every
   * refusal message. A reader scrolling back from the bottom of a red run finds
   * the transcript before they find anything else, which is the one moment they
   * need it. On success it is not printed: a green ship already said what it
   * did, and a line nobody needs at the end of every good run is how people
   * learn to stop reading the end of the run.
   */
  if (code !== 0) {
    const line = `\n  transcript: ${logPath}\n`;
    process.stderr.write(line);
    writeSync(handle, line);
  }
  closeSync(handle);
  return code;
}

if (!process.env.SHIP_TRANSCRIPT) {
  process.exit(await teeSelfToLog());
}

/*
 * THE ORIGIN, IMPORTED rather than restated.
 *
 * It was a literal here and a literal in `app/lib/seo.ts`, and this is the
 * script that polls the deploy it just made: the copy that goes stale is the
 * one that then polls the wrong host and reports a healthy site nobody is
 * looking at. `check:llms` and `check:invariants` both already read the value
 * out of seo.ts to hold other documents to it; this one can simply import it,
 * because Node strips the types and the module has no bindings to resolve.
 *
 * At the DNS cutover this follows seo.ts by construction. Rule 17.
 */
const ORIGIN = SITE_ORIGIN;
const POLL_PATH = "/colophon";
const POLL_COUNT = 5;
const POLL_GAP_MS = 10_000;

/**
 * What ship asks whether the deploy is READY, as opposed to merely answering.
 *
 * A named constant rather than an inline path, so the plant that proves this
 * step can fail has one place to point somewhere else. `check:policy` asserts
 * that it is this endpoint and that the step runs between the deploy and the
 * sync, so pointing it elsewhere permanently is a failing gate rather than a
 * quiet downgrade.
 */
const READINESS_PATH = "/api/health";


let step = 0;

/** @param {string} title */
function announce(title) {
  step += 1;
  console.log(`\n${"=".repeat(64)}\n  ${step}. ${title}\n${"=".repeat(64)}`);
}

/**
 * Refuse, loudly, naming the step and the remedy. Never a bare exit.
 *
 * Declared `never` because it genuinely never returns: it exits the process.
 * Saying so lets a caller narrow a value it has just refused on, instead of
 * casting around a check that has already happened.
 *
 * @param {string} why @param {string} remedy
 * @returns {never}
 */
function refuse(why, remedy) {
  console.error(`\n  REFUSED at step ${step}: ${why}\n  ${remedy}\n`);
  process.exit(1);
}

/** @param {string} command @param {string[]} args */
function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (capture) {
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    process.stdout.write(text);
    return { code: result.status ?? 1, text };
  }
  return { code: result.status ?? 1, text: "" };
}

/* ---------------------------------------------------------------- 1. tree */


/*
 * THE OPERATOR TOKEN IS CHECKED BEFORE ANYTHING DEPLOYS, and the split is
 * deliberate.
 *
 * Step 10 calls the operator API to bring the Ask index into step, because
 * `sync:content` rebuilds D1 and both FTS indexes and does not touch AI Search.
 * A CONFIGURATION problem is not the same as a failed call: missing the token
 * is fixable in a second and should not cost a deploy, so it refuses here,
 * before the build. A call that FAILS after the deploy is a different thing and
 * is handled where it happens, loudly, with the deploy left standing.
 *
 * Sourced the way `operator-roundtrip.mjs` already sources it: a path in
 * OPERATOR_TOKEN_FILE pointing at a file holding the token. The token itself is
 * never an argument, never an environment value that a child process inherits
 * by name, and never printed. The length floor is the one `auth.server.ts`
 * enforces, so a truncated file is refused here rather than 401ing after a
 * deploy.
 */
const TOKEN_FILE = process.env.OPERATOR_TOKEN_FILE;
if (!TOKEN_FILE) {
  refuse(
    "OPERATOR_TOKEN_FILE is not set, so ship cannot bring the Ask index into step",
    "Point OPERATOR_TOKEN_FILE at a file holding the operator token. It is a " +
      "wrangler secret, it is not in the repository, and it must not be pasted " +
      "into a command line. Nothing has been built or deployed.",
  );
}
let OPERATOR_TOKEN = "";
try {
  OPERATOR_TOKEN = readFileSync(TOKEN_FILE, "utf8").trim();
} catch {
  refuse(
    `OPERATOR_TOKEN_FILE points at a file that cannot be read: ${TOKEN_FILE}`,
    "Nothing has been built or deployed.",
  );
}
if (OPERATOR_TOKEN.length < 32) {
  refuse(
    "the token in OPERATOR_TOKEN_FILE is shorter than the 32 characters the Worker requires",
    "auth.server.ts treats a short secret as a misconfiguration and answers 503. " +
      "Nothing has been built or deployed.",
  );
}

announce("Working tree must be clean");

const porcelain = spawnSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf8",
});
if (porcelain.status !== 0) {
  refuse("git status failed", "Is this a git repository?");
}
const dirty = (porcelain.stdout ?? "").trim();
if (dirty.length > 0) {
  console.error(dirty);
  refuse(
    "the working tree is not clean",
    "`npm run deploy` builds from the WORKING TREE, not from HEAD, so this would " +
      "ship code that exists on no commit. Commit or stash first.",
  );
}
console.log("  clean.");

const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
const sha = (head.stdout ?? "").trim();
// The FULL sha as well: `actions/runs?head_sha=` matches on the 40-character
// form and returns an empty list for an abbreviated one, which would read as
// "no CI run for this commit" on every ship.
const headFull = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
const shaFull = (headFull.stdout ?? "").trim();
console.log(`  HEAD is ${sha}`);

/*
 * STEP 1b, THE STATED-ABSENCE PLACEHOLDER CHECK, WAS DELETED 2026-08-21.
 *
 * It iterated `const PLACEHOLDERS = []` and printed "no stated-absence
 * placeholders are declared, so nothing was checked here." It had carried
 * exactly one entry, `CACHE_SENTENCE_PENDING_PROBE`, and that entry was
 * resolved on 2026-08-14. It was kept as a mechanism for the next one.
 *
 * **A dead loop kept for a hypothetical successor is not a mechanism, it is a
 * shape.** Re-adding it when a second stated absence appears is six lines and a
 * comment, and writing those six lines with a real subject in hand produces a
 * better check than reviving a generalisation drawn from one case.
 *
 * The property it guarded is NOT lost. `check:admin-ui` asserts both halves on
 * the rendered page: the measured answer is present, and the placeholder
 * wording is gone. That is the assertion with teeth, because it reads the
 * product rather than a list somebody has to remember to add to.
 */

/* ------------------------------------------------- 1b. CI's verdict, early */

/*
 * **RULING 52, 2026-09-09 (Dustin). SHIP TRUSTS CI.**
 *
 * CI already runs the offline tier on a clean checkout of this exact sha, on a
 * machine that has never seen this repo. When it concluded success there, the
 * local build-for-gates and the local offline tier are a second opinion about a
 * question already answered, and they are the expensive half of a ship: about
 * twelve minutes falls to about four, and the local memory peak that killed
 * five `check:all` runs goes with it.
 *
 * ## THIS READ DECIDES A PATH. IT NEVER DECIDES A DEPLOY.
 *
 * That separation is the whole safety argument and it is worth stating plainly.
 * The verdict here chooses between the fast path and the local path, and
 * NOTHING ELSE: a non-green answer, of any kind, takes the local path rather
 * than refusing. The authoritative check is the unchanged step below, which
 * runs on EVERY path and refuses on anything but success. So the worst this
 * read can do when it is wrong is make ship do MORE work, never less.
 *
 * ## WHY THE SECOND READ IS NOT REDUNDANT WITH THIS ONE
 *
 * Because a pending run is the common case, not an edge. Push, run ship, and CI
 * is still in flight: this read says "not green yet", ship runs the local build
 * and tier for ten minutes, and by the time the step below reads again the run
 * has concluded. The two reads are minutes apart on purpose, and the later one
 * is the one with teeth. A run that was FAILED here and re-run to green in the
 * meantime is caught by the same mechanism, in the same direction.
 *
 * ## WHAT IS NOT SKIPPED, AND WHY IT CANNOT BE
 *
 * `build:stack` and `build:enhance` run on BOTH paths. They write gitignored
 * files that `react-router build` imports statically, so the deploy's own build
 * fails on a missing file without them. They are not part of the gate tier's
 * cost; they are preconditions of building at all.
 *
 * ## OBSERVATION BOUNDARY, INHERITED
 *
 * Unchanged from the step below and restated because this read now has a
 * consequence of its own: it reads GitHub's view of a sha. It cannot see
 * whether CI's assertions are meaningful, nor whether the workflow was edited
 * to assert nothing in the same commit. A green CI on a commit that gutted CI
 * would skip the local tier, and the local tier would have run that same gutted
 * workflow's checks. The property is the same on both paths.
 */

announce("CI's verdict on this exact commit");

const remote = spawnSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" });
const slug = ((remote.stdout ?? "").trim().match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/) ?? []).slice(1, 3);
if (slug.length !== 2) {
  refuse(
    "the origin remote is not a GitHub URL, so CI cannot be consulted",
    `git remote get-url origin said ${JSON.stringify((remote.stdout ?? "").trim())}. ` +
      "This check fails closed rather than assuming CI passed.",
  );
}
const [owner, repo] = slug;

/*
 * **THE TOKEN IS REQUIRED, and the brief that specified this check assumed it
 * was not.** The assumption was that the repository is public, so Actions runs
 * would be readable unauthenticated. MEASURED 2026-08-23: `private=true`. An
 * unauthenticated read answers 404, because GitHub returns 404 rather than 403
 * for a private resource you may not see, so the fallback would refuse every
 * ship while reporting that the repository does not exist.
 *
 * `gh auth token` is the token path. Ship has no token of its own: GITHUB_TOKEN
 * is a wrangler secret and is not in this process's environment. If `gh` is
 * absent or logged out, the step below refuses, which is the correct direction:
 * a check that cannot read CI has not confirmed CI.
 */
const ghToken = (() => {
  const t = spawnSync("gh", ["auth", "token"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  return t.status === 0 ? (t.stdout ?? "").trim() : "";
})();

/**
 * One read of GitHub's verdict on HEAD. Called twice, minutes apart.
 *
 * Returns rather than refusing, because the two callers want opposite things
 * from the same failure: this one takes the slow path, the one below refuses.
 * A single function with a `shouldRefuse` flag would be one helper with two
 * meanings, which is the shape hard rule 10 names.
 *
 * @returns {Promise<{ verdict: { ok: boolean, why: string, remedy: string } | null, error: string }>}
 */
async function readCi() {
  try {
    const runs = await fetchCiRuns({ owner, repo, sha: shaFull, token: ghToken });
    return { verdict: ciVerdict(runs, sha), error: "" };
  } catch (error) {
    return { verdict: null, error: error instanceof Error ? error.message : String(error) };
  }
}

console.log(`  reading CI for ${owner}/${repo}@${sha} (${ghToken ? "authenticated" : "unauthenticated"})`);
const early = await readCi();

/** Chooses the path only. The step below decides the deploy, on every path. */
const ciGreenEarly = early.verdict?.ok === true;

if (ciGreenEarly) {
  console.log(`  ${early.verdict?.why}.`);
  console.log(`  CI green for ${sha}, skipping local gates`);
} else {
  console.log(`  ${early.error ? `CI could not be read: ${early.error}` : early.verdict?.why}.`);
  console.log("  taking the local path: the build and the offline tier run below.");
  console.log("  CI is still REQUIRED, and is read again after them.");
}

/* ------------------------------------------ 1c. the deployed schema is current */

/*
 * **NO MIGRATION MAY BE PENDING WHEN A DEPLOY GOES OUT.**
 *
 * SHIP WINDOW 5 is why this exists. It deployed with every offline gate green
 * and the media admin page returned a 500 on its first load, because
 * `0011_media_trash_tags.sql` had been pending on the remote database since the
 * session that authored it, four sessions earlier. `trashed_at` and `tags` did
 * not exist, and every media loader query threw.
 *
 * Nothing in the repo could see it. Ship applies no migrations and compares no
 * schema. `check:migrations` compares FILES to a hash manifest and never to a
 * database. `check:admin-ui` renders the route with every `.server` import
 * stubbed, so the loader never runs. Authoring a migration created an
 * obligation in no instrument anywhere.
 *
 * ## IT REFUSES. IT DOES NOT APPLY.
 *
 * `0011` happened to be additive, two `ADD COLUMN` and an index, and ship
 * cannot tell that from a `DROP` or a rewrite without reading and classifying
 * SQL. Being wrong about that once is unrecoverable, and a deploy that silently
 * mutates the production schema is worse than one that stops. The operator
 * decides; this makes sure they are ASKED rather than finding out from a 500.
 *
 * ## BEFORE THE BUILD, not merely before the deploy
 *
 * The ruling says before deploy. This is earlier than it has to be, and that is
 * deliberate: the answer cannot change during a build on a single-operator
 * system, and refusing in five seconds is kinder than refusing after two
 * minutes of build and gates. It sits with the other preconditions about the
 * state of the world, beside the clean-tree check.
 *
 * FAIL CLOSED. Three outcomes, not two: pending refuses naming the files,
 * clean proceeds, and anything unreadable, including a non-zero exit from a
 * network or auth failure, refuses saying so. `readMigrationList` owns that
 * decision and is unit tested against wrangler output recorded from a real
 * database in both states.
 */

announce("The deployed database has every migration");

const DATABASE = "dustinedwards";

/*
 * WRAPPED IN `retryRead`, and this is the EIGHTH incident in that class.
 *
 * The guard refused on its first live use, in SHIP WINDOW 6, with
 * `The given account is not valid or is not authorized to access this service
 * [code: 7403]`. It was not a credential fault: `wrangler whoami` reported the
 * right account with `d1 (write)` scope and no overriding env var, and the
 * identical command re-run immediately returned `No migrations to apply!`. A
 * transient on a Cloudflare control-plane READ, which is exactly the class
 * `retry.mjs` already wraps at 27 other sites, at the one site nobody had
 * wrapped. It cost a ship attempt.
 *
 * A READ, so this is inside the documented policy rather than an exception to
 * it: the wrapper's own header says reads only, never a write, and listing
 * migrations mutates nothing.
 *
 * **ONLY `unreadable` IS RETRIED, and the distinction is the whole implementation.**
 * `readMigrationList` RETURNS its verdict and never throws, so wrapping the
 * spawn alone would have retried nothing at all: a 7403 exits non-zero, the
 * parser reports `unreadable`, and `retryRead` sees a perfectly resolved
 * promise. So the wrapped function throws on that verdict and only that one.
 * `pending` is a real answer about the world, not a transient, and retrying it
 * would spend 90 seconds re-asking a question already correctly answered before
 * a refusal that was always going to happen.
 *
 * The second failure propagates unchanged and lands in the same refusal it
 * would have without this, which is what the `catch` below preserves.
 */
let migrations;
try {
  migrations = await retryRead(
    () => {
      const listed = run(
        "npx",
        ["wrangler", "d1", "migrations", "list", DATABASE, "--remote"],
        { capture: true },
      );
      const verdict = readMigrationList({ code: listed.code, text: listed.text });
      // The ONE retryable outcome. Thrown rather than returned so the wrapper
      // can see it; caught below so the refusal is unchanged either way.
      if (verdict.state === "unreadable") {
        const error = new Error(verdict.reason);
        /** @type {any} */ (error).verdict = verdict;
        throw error;
      }
      return verdict;
    },
    { label: "wrangler d1 migrations list (deployed schema)" },
  );
} catch (error) {
  migrations = /** @type {any} */ (error)?.verdict ?? {
    state: "unreadable",
    pending: [],
    reason: error instanceof Error ? error.message : String(error),
  };
}

if (migrations.state === "pending") {
  refuse(
    `the deployed database is missing ${migrations.pending.length} migration(s): ` +
      migrations.pending.join(", "),
    `Apply them first, then re-run ship:
    ${applyCommand(DATABASE)}
  ` +
      "  Ship does not apply migrations itself: additive and destructive look " +
      "the same from here, so the choice is yours.",
  );
}
if (migrations.state === "unreadable") {
  refuse(
    `the deployed schema could not be determined: ${migrations.reason}`,
    "Ship refuses on an unknown rather than deploying past it. Check network " +
      `and credentials, then re-run. To see it yourself:
    npx wrangler d1 ` +
      `migrations list ${DATABASE} --remote`,
  );
}
console.log(`  ${migrations.reason}.`);

/* --------------------------------------------------------------- 2. build */

announce("Build");
/*
 * THE STACK ARTIFACT FIRST, and it has to be inside the build step rather than
 * beside build:content at step 12. content/generated/stack.json is gitignored
 * since ruling 39a, and three route modules import it statically, so the Worker
 * bundle carries its bytes. A run that derived it after the deploy would ship
 * whatever a previous run left on disk, or fail the build outright on a clean
 * clone. Deriving it here also serves the two later readers for free: the gates
 * at step 3 and build:content at step 12 both find it already written.
 */
if (run("npm", ["run", "build:stack"]).code !== 0) {
  refuse("the stack artifact build failed", "Fix build:stack. Nothing was deployed.");
}
// The enhancement bundles next: the app build's ?url imports name files under
// the gitignored app/enhance/dist/, so a build without this step fails on a
// missing file that is not the tree's fault.
if (run("npm", ["run", "build:enhance"]).code !== 0) {
  refuse("the enhancement bundle build failed", "Fix build:enhance. Nothing was deployed.");
}
/*
 * THE APP BUILD IS THE GATE TIER'S, not the deploy's, and that is why ruling 52
 * can skip it. `npm run deploy` is `npm run build && wrangler deploy`, so the
 * bundle that ships is built below either way. What this call exists for is
 * `check:page-payload`, which reads `build/client` and is in the tier that the
 * next step runs. Skip the tier and this build has no reader.
 */
if (ciGreenEarly) {
  console.log("  skipped: react-router build. Its only local reader is the tier below, which CI ran.");
  console.log("  the deploy builds the bundle it ships, on this path and on the other one.");
} else if (run("npm", ["run", "build"]).code !== 0) {
  refuse("the build failed", "Fix the build. Nothing was deployed.");
}

/* --------------------------------------------------------------- 3. gates */

announce("Gates, offline tier");
if (ciGreenEarly) {
  /*
   * RULING 52. Not "the gates did not run": they ran, on a clean checkout of
   * this sha, on a machine with no local node_modules and no generated types.
   * VERIFICATION.md names those as two different instruments, and this is the
   * stronger of the two for everything except the handful of gates CI excludes.
   */
  console.log(`  skipped: CI ran this tier on a clean checkout of ${sha}.`);
  console.log("  re-read below, and a CI that is no longer green refuses there.");
} else if (run("npm", ["run", "check"]).code !== 0) {
  refuse(
    "a gate is red",
    "Read the table above for the failing gate NAME before retrying. Nothing was deployed.",
  );
}

/* ------------------------------------------------------------- 4. CI green */

/*
 * **CI IS ENFORCED HERE, AT THE DEPLOY PRIMITIVE, AND NOWHERE ELSE.**
 *
 * The 2026-08-22 audit, section 8: "CI runs on push to main, after the fact.
 * Nothing prevents a push that fails CI from being deployed, because deploy is
 * manual and local. The gate tier runs in `ship`, so in practice the same checks
 * run, but CI is advisory only." Verified true: nothing consulted CI before.
 *
 * Branch protection was the obvious alternative and does not solve this. It
 * governs what may MERGE; it has no opinion about a local `npm run deploy`, and
 * this repo is mainline-only until cutover, so there is no merge to protect.
 * The deploy is the primitive that matters, so the check belongs immediately in
 * front of it.
 *
 * ## WHY IT IS NOT REDUNDANT WITH THE LOCAL TIER, WHEN THE LOCAL TIER RAN
 *
 * The local tier runs the offline gates ON THIS DISK, with this machine's
 * node_modules, generated types and real wrangler.jsonc. CI runs them on a
 * clean checkout that has never seen the repo. They answer different questions,
 * and VERIFICATION.md names them as two of the four instruments. A dependency
 * installed locally and absent from the lockfile is invisible to the local tier
 * and fatal in CI.
 *
 * Since ruling 52 the local tier runs only when CI has not already answered for
 * this sha, so on the fast path there is no second opinion to be redundant
 * with, and the reason above is exactly why the fast path is the safe direction
 * to drop: it drops the WEAKER of the two instruments and keeps the stronger.
 *
 * ## FAIL CLOSED, IN EVERY DIRECTION, AND NO OVERRIDE FLAG
 *
 *   no run for this sha    refuse. Unpushed, or CI never triggered.
 *   run still in progress  refuse. A green-so-far run is not a green run.
 *   conclusion not success refuse, naming the conclusion.
 *   API unreachable        refuse. Ship already needs the network to deploy, so
 *                          "the network is down" cannot be a reason to skip a
 *                          safety check and proceed to a step that needs it.
 *
 * There is deliberately no `--force`. A flag would be used, and it would be used
 * on exactly the day the check was right.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It reads GitHub's view of a sha. It cannot see whether CI's assertions are
 * meaningful, whether the workflow was edited to assert nothing in the same
 * commit, or whether a run was re-run until it passed. It proves a green run
 * exists for this exact commit, which is strictly more than nothing knew before.
 */

announce("CI must be green for this exact commit");

/*
 * **THIS IS THE READ WITH TEETH, ON EVERY PATH.** Ruling 52 changed which work
 * runs before it; it did not change this step, and that is the point. The early
 * read at step 2 chose a path. This one decides the deploy, and refuses in the
 * four directions `ciVerdict` names whether or not the tier ran locally.
 *
 * It is a SECOND read rather than the early verdict reused, on BOTH paths, and
 * the uniformity is deliberate. On the local path ten minutes have passed and a
 * run that was pending then may have concluded in either direction; reusing the
 * early answer would refuse a ship whose CI went green while the gates ran, and
 * would be a stale claim besides. On the fast path the two reads are seconds
 * apart and will agree, so the call buys no information and buys something
 * better: this step reads fresh and decides, with no branch, so there is no
 * arrangement of the code in which a deploy is authorised by a verdict that was
 * not re-read here. One extra API call against eight minutes saved is not a
 * trade worth thinking about twice.
 */
console.log(`  reading CI for ${owner}/${repo}@${sha} (${ghToken ? "authenticated" : "unauthenticated"})`);
const { verdict, error: ciError } = await readCi();

if (ciError) {
  refuse(
    `the GitHub API could not be reached: ${ciError}`,
    "Ship needs the network to deploy anyway, so an unreachable API is not a reason to " +
      "skip the check and proceed. Nothing was deployed.",
  );
}
if (!verdict || !verdict.ok) {
  refuse(
    verdict?.why ?? "CI could not be read",
    verdict?.remedy ?? "Nothing was deployed.",
  );
}
console.log(`  ${verdict.why}.`);

/* -------------------------------------------------------------- 4. deploy */

announce("Deploy");
const deploy = run("npm", ["run", "deploy"], { capture: true });
if (deploy.code !== 0) {
  refuse("the deploy failed", "Nothing was synced. The previous version is still serving.");
}
const version = (deploy.text.match(/Current Version ID:\s*([0-9a-f-]{8,})/i) ?? [])[1] ?? "";
if (!version) {
  refuse(
    "the deploy reported no Version ID",
    "It may have succeeded, but a ship that cannot name what it shipped did not ship. " +
      "Check `npx wrangler deployments list` before syncing.",
  );
}

/* ---------------------------------------------------------------- 5. poll */

announce(`Poll to stability: ${POLL_COUNT} consecutive 200s, ${POLL_GAP_MS / 1000}s apart`);

let streak = 0;
for (let i = 0; i < POLL_COUNT; i += 1) {
  // Cache BYPASSED deliberately. A HIT proves the edge has bytes, not that the
  // new Worker answers, and a probe during the rollout window can be served by
  // the PREVIOUS version.
  const url = `${ORIGIN}${POLL_PATH}?ship=${sha}-${i}-${step}`;
  let status = 0;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ship", "cache-control": "no-cache" },
      redirect: "manual",
    });
    status = res.status;
    console.log(`  probe ${i + 1}: ${status}  cf=${res.headers.get("cf-cache-status") ?? "-"}`);
  } catch (error) {
    console.log(`  probe ${i + 1}: FETCH FAILED ${error instanceof Error ? error.message : error}`);
  }
  streak = status === 200 ? streak + 1 : 0;
  if (i < POLL_COUNT - 1) await new Promise((r) => setTimeout(r, POLL_GAP_MS));
}
if (streak !== POLL_COUNT) {
  refuse(
    `the site did not answer ${POLL_COUNT} consecutive 200s (streak ended at ${streak})`,
    "The deploy landed but the site is not stable. NOTHING WAS SYNCED, which is the " +
      "safe direction: the index still describes the previous build.",
  );
}
console.log(`  ${POLL_COUNT} consecutive 200s.`);

/* ------------------------------------------------------- 5b. readiness */

/*
 * FIVE 200s SAY THE WORKER ANSWERS. THEY DO NOT SAY IT IS HEALTHY.
 *
 * The poll above requests `/colophon` and reads a status line. That is a real
 * check and it catches a Worker that failed to boot, a broken route table and
 * a rollout that has not finished. It is blind to every invariant this site
 * actually watches: a drifted Ask index, a media index that lost its rows, D1
 * out of step with the repository, an FTS index that is empty while its
 * content table is full. All five of those serve `/colophon` with a 200.
 *
 * `/api/health` answers exactly those questions and ship has never once asked
 * it, which is the odd half: the scheduled workflow reads that endpoint every
 * fifteen minutes and alerts on it, so the deploy path was the ONLY path that
 * shipped without consulting the instrument the site trusts the rest of the
 * time.
 *
 * ## WHY HERE, BETWEEN THE POLL AND THE SYNC
 *
 * After the poll, because a Worker that is still rolling out would answer this
 * from the previous version and the verdict would be about the wrong build.
 * Before the D1 sync, because the sync is the first thing in this script that
 * WRITES, and a refusal after it has run leaves production half converged.
 * Refusing here costs nothing: the deploy stands and serves, and the index
 * still describes the previous build, which is the same safe direction the
 * poll's own refusal takes.
 *
 * ## THE STATUS LINE IS NOT ENOUGH, AND THAT IS DELIBERATE
 *
 * `ok: true` is read out of the BODY rather than inferred from a 200. The two
 * agree today, and relying on that agreement would make this step depend on a
 * property of the endpoint that lives in a different file. The endpoint's own
 * docblock says the status line is the contract for the WORKFLOW, which reads
 * it with `curl --fail`; this reads a parsed body because it can, and because
 * printing the five verdicts is most of the value when it refuses.
 *
 * A 429 is called out separately. Since the rate limit landed, a burst from
 * this address can refuse the check, and "rate limited" and "unhealthy" need
 * different repairs.
 */
announce(`Readiness: ${READINESS_PATH} reports ok`);

{
  const url = `${ORIGIN}${READINESS_PATH}?ship=${sha}-${step}`;
  /** @type {number} */
  let status = 0;
  /** @type {string} */
  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ship", "cache-control": "no-cache" },
      redirect: "manual",
    });
    status = res.status;
    text = await res.text();
  } catch (error) {
    refuse(
      `${READINESS_PATH} could not be reached: ${error instanceof Error ? error.message : error}`,
      "The deploy landed and the poll passed, so this is a network problem or the " +
        "endpoint is gone. NOTHING WAS SYNCED.",
    );
  }

  const verdict = readinessVerdict(status, text, READINESS_PATH, Object.keys(DEFERRED_CHECKS));

  // Printed for BOTH outcomes, before the verdict is acted on, so a reader
  // never has to run the endpoint by hand to see which check failed.
  for (const line of readinessLines(verdict.checks)) console.log(line);

  if (!verdict.ok) refuse(verdict.why, verdict.remedy);

  /*
   * A DEFERRED CHECK THAT IS FAILING RIGHT NOW IS SAID OUT LOUD, so the table
   * above cannot be read as a clean sweep. It is not a refusal here and it is
   * not forgiven either: the assertion moves to after the sync, which is the
   * step that repairs it.
   */
  const deferredFailing = verdict.deferredFailing ?? [];
  for (const name of deferredFailing) {
    console.log(
      `  deferred: ${name} is failing now, and ${DEFERRED_CHECKS[name]} is what ` +
        `converges it. Asserted again after that step.`,
    );
  }
  console.log(
    `  ${verdict.checks.length} check(s) read, ${verdict.checks.length - deferredFailing.length} gating and ok.`,
  );
}

/* ------------------------------------------- 5c. the watchdog Worker */

/*
 * THE SECOND DEPLOY, AND IT IS DELIBERATELY NOT A REFUSAL.
 *
 * `workers/watchdog.ts` is a separate Worker with its own config and its own
 * Cron Trigger. It has to be deployed by something, and ship is the only thing
 * that deploys anything here, so a watchdog left to a remembered manual command
 * is a watchdog that silently runs an old build until somebody notices it did
 * not repair something.
 *
 * ## WHY AFTER THE SITE, AND AFTER THE READINESS CHECK
 *
 * Deploy-first ordering, and there are two reasons rather than one.
 *
 * The watchdog binds to the site through a SERVICE BINDING, so the site has to
 * exist for its config to resolve. That alone would only argue for "after the
 * site deploy". It runs after READINESS as well because a watchdog pointed at a
 * Worker this run has not yet proven healthy is a watchdog whose first firing
 * reports a fault it was deployed into, which is noise from a monitor on the
 * day it lands and is exactly the shape that gets monitors muted.
 *
 * ## AND WHY A MISS RATHER THAN A REFUSAL
 *
 * This runs after the deploy has LANDED. Refusing here would abandon the sync
 * with production half converged, and it would do so over the watcher rather
 * than over the thing being watched. The site is serving; a stale watchdog is a
 * degraded monitor, not a degraded site.
 *
 * So it takes the same shape as the Ask and media steps: the deploy STANDS, the
 * record prints, and ship exits nonzero at the very end with the miss named
 * beside any others. LOUD AND LAST, which is the property the ruling asked for.
 *
 * The failure is not silent in the other direction either: the previous
 * watchdog build keeps firing, so the site stays watched by the code that was
 * already there.
 */

announce("Deploy the watchdog Worker");

/** Set when the watchdog deploy did not land. Read at the very end. */
let watchdogMiss = "";

{
  const deployed = run(
    "npx",
    ["wrangler", "deploy", "-c", "wrangler.watchdog.jsonc"],
    { capture: true },
  );

  if (deployed.code !== 0) {
    watchdogMiss =
      "the watchdog Worker did not deploy, so the fifteen-minute self-repair poll is " +
      "still running whatever was deployed before this run";
  } else {
    /*
     * THE VERSION ID IS READ, on the same rule the site deploy applies: a ship
     * that cannot name what it shipped did not ship. A zero exit from wrangler
     * with no version in the output is the shape that would let a no-op deploy
     * report success.
     */
    const watchdogVersion =
      (deployed.text.match(/Current Version ID:\s*([0-9a-f-]{8,})/i) ?? [])[1] ?? "";
    if (!watchdogVersion) {
      watchdogMiss =
        "the watchdog deploy reported no Version ID, so nothing proves which build is " +
        "now on the cron";
    } else {
      console.log(`  watchdog version ${watchdogVersion}`);
      /*
       * THE TRIGGER IS READ BACK OUT OF WRANGLER'S OWN OUTPUT, because the
       * config asking for a cron and the platform having registered one are two
       * different facts, and only the second one fires. `check:config` owns the
       * first and cannot see the second: it reads a file. This reads what
       * wrangler says it did.
       *
       * A MISS RATHER THAN A REFUSAL, on this step's own rule. A Worker
       * deployed without its schedule is a Worker that never runs, which is
       * precisely the silent failure the whole arc exists to end, so it must be
       * reported; it is still not worth abandoning a converged sync over.
       */
      if (!/schedule|cron|trigger/i.test(deployed.text)) {
        watchdogMiss =
          "the watchdog deployed but wrangler's output named no cron trigger, so the " +
          "schedule may not be registered and the Worker would never fire";
      }
    }
  }

  if (watchdogMiss) console.log(`  MISSED: ${watchdogMiss}`);
}

/*
 * ## THE EXTERNAL UPTIME MONITORS, POINTED AT WHAT THIS RUN DEPLOYED
 *
 * AFTER READINESS AND AFTER THE WATCHDOG, and the position carries the same
 * argument the watchdog step does: both bind an outside instrument to this
 * site, and neither may be pointed at a build this run has not proven. If the
 * readiness step refused, ship never reaches here and the monitors keep
 * watching the previous deploy, which is the correct behaviour rather than a
 * gap.
 *
 * **THIS IS THE STEP THAT MAKES THE CUTOVER ONE EDIT.** `SITE_ORIGIN` is the
 * one owner of the hostname (rule 17); `uptime-ensure` derives both monitor
 * URLs from it and PATCHes the live monitors to match. So the DNS cutover
 * changes one constant, and the next ship repoints the monitors without anyone
 * opening a dashboard. `check:uptime` is what refuses if that ever stops being
 * true.
 *
 * A MISS, NOT A REFUSAL, on the watchdog step's rule. The deploy STANDS: the
 * site is live and healthy by this point, and an UptimeRobot API failure is a
 * reason to tell somebody, never a reason to unmake a good deploy. It is
 * reported LOUD and ship exits nonzero at the end with it named beside any
 * other miss.
 *
 * IDEMPOTENT, so running it on every ship costs nothing when nothing moved:
 * measured 2026-09-07, a second consecutive run reports "0 change(s) applied"
 * and rewrites the manifest byte-identically.
 */
announce("Point the uptime monitors at this deploy");

/** Set when uptime-ensure did not land. Read at the very end. */
let uptimeMiss = "";

{
  const ensured = run("node", ["scripts/uptime-ensure.mjs"], { capture: true });
  if (ensured.code !== 0) {
    uptimeMiss =
      "uptime-ensure did not complete, so the external monitors may still point at the " +
      "previous hostname or may not exist. The deploy stands and is healthy; what is " +
      "unproven is whether anything outside Cloudflare is watching it";
    console.log(`  MISSED: ${uptimeMiss}`);
  } else {
    /*
     * THE VERDICT IS READ, NEVER INFERRED FROM EXIT 0, which is the rule this
     * file applies to every operator round trip. `uptime-ensure` prints one
     * line per monitor and a change count; a run that somehow reconciled
     * nothing would still exit 0, and that is the shape worth catching.
     */
    const applied = ensured.text.match(/(\d+) change\(s\) applied/);
    if (!applied) {
      uptimeMiss =
        "uptime-ensure exited 0 without reporting a change count, so nothing proves it " +
        "reconciled the monitors";
      console.log(`  MISSED: ${uptimeMiss}`);
    } else {
      console.log(`  monitors reconciled, ${applied[1]} change(s)`);
    }
  }
}

/* ------------------------------------------------------- 6. gate, then sync */

/*
 * BUILT HERE, EXPLICITLY, even though the gate tier's own build step already
 * ran one: the product is gitignored since the artifact arc, the sync below
 * reads it off disk, and "whatever the last run left behind" is not a
 * provenance. A ship window owns the tree, so this rebuild is byte-identical
 * to the tier's; it exists so the sync's input is the build this ship ran.
 */
announce("build:content, the local build product the sync reads");
if (run("npm", ["run", "build:content"]).code !== 0) {
  refuse("the content build failed", "NOTHING WAS SYNCED.");
}

announce("check:content, because sync runs no gate of its own");
if (run("npm", ["run", "check:content"]).code !== 0) {
  refuse(
    "the content gate is red: the corpus fails validation or renders nondeterministically",
    "Fix the content or the pipeline. NOTHING WAS SYNCED. " +
      "sync-content.mjs would have pushed a corpus the gate refused into production D1.",
  );
}

announce("Sync content to remote D1");

/** Set when the sync reported render drift. Read at the very end. */
let renderDriftMiss = "";

const sync = run("npm", ["run", "sync:content", "--", "--remote"], { capture: true });
if (sync.code !== 0) {
  /*
   * TWO DIFFERENT NONZEROES, told apart by the report the sync prints.
   *
   * A sync that reported RENDER DRIFT finished every write and every
   * verification, exited nonzero as an alarm, and printed the counts line;
   * D1 is converged and the deploy must stand while the run still fails at
   * the end, exactly like an index miss. A sync that failed for any other
   * reason may have left D1 partially written and refuses here as it always
   * has. The discriminator is the drift line's own count, not the exit code,
   * because the exit code carries one bit and this is a two-fault channel.
   */
  const driftLine = sync.text.match(/sync:content drift: .*render-drift=(\d+)/);
  if (driftLine && Number(driftLine[1]) > 0) {
    const slugs = sync.text.match(/RENDER DRIFT on \d+ slug\(s\): ([^.]*)\./);
    const named = slugs ? slugs[1] : "unnamed slug(s)";

    /*
     * DRIFT ON THE FIRST SYNC IS NOT YET A DEFECT. Ruling 30, vol 15.
     *
     * THE ORDERING ARTIFACT, which is what this usually is. The previously
     * deployed Worker's content-drift poll front-runs the deploy by up to one
     * poll interval: it pulls the new markdown, renders it with the OLD
     * renderer and writes that hash to D1. The sync above then reads a D1 hash
     * the old pipeline produced, compares it against the NEW build, and calls
     * it drift. Proven byte-exact when it was first met, by rendering the
     * flagged slug through the old pipeline and matching the flagged hash.
     * Nothing is wrong: the write the sync just did is the repair.
     *
     * THE SECOND SYNC IS WHAT TELLS THE TWO APART, and it is the same
     * read-back the three index repairs use rather than a new idea. The first
     * sync converged every row to the build, so a second one reads zero UNLESS
     * the converge write did not take, and that is a real defect: a partially
     * applied write, or something else writing render_hash behind us. A report
     * assembled from the first run's own counters cannot see either.
     *
     * So drift confirmed by a second run FAILS the ship, and drift that
     * clears completes it. This used to report every first-run drift as "a
     * pipeline defect to find", which cried wolf on two consecutive ships
     * where the artifact was benign and had already been ruled benign.
     */
    console.log(`  render drift on ${named}: converged, confirming with a second sync`);
    const confirm = run("npm", ["run", "sync:content", "--", "--remote"], { capture: true });
    const confirmLine = confirm.text.match(/sync:content drift: .*render-drift=(\d+)/);

    if (!confirmLine) {
      refuse(
        "the confirming sync did not report a drift line",
        "The first sync converged D1 and the second could not be read, so whether " +
          "the drift cleared is UNKNOWN. Re-run `npm run ship`.",
      );
    } else if (Number(confirmLine[1]) === 0) {
      console.log(
        `  confirmed benign: the second sync reads render-drift=0, so D1 carried a ` +
          `render from the previously deployed Worker (ruling 30) and the converge ` +
          `write took. Not a pipeline defect.`,
      );
    } else {
      renderDriftMiss =
        `render drift on ${named} SURVIVED a converge write: the first sync wrote ` +
        `the build's render to every row and a second sync still reads ` +
        `render-drift=${confirmLine[1]}. This is not the ordering artifact of ruling ` +
        `30, which clears on the second run. Either the write is not taking or ` +
        `something is rewriting render_hash behind the sync.`;
      console.log(`  MISSED: ${renderDriftMiss}`);
    }
  } else {
    refuse("the sync failed", "D1 may be partially written. Re-run `npm run ship`.");
  }
}

/*
 * The counts line is the proof, not the exit code. `search_docs` is the derived
 * table and the two FTS indexes are rebuilt from it; if they disagree the index
 * is silently stale, and `COUNT(*)` on either index reads THROUGH to the
 * content table and can never detect that. These are the docsize numbers.
 */
const counts = (sync.text.match(/search_docs=(\d+)\s+identity=(\d+)\s+prose=(\d+)/) ?? []).slice(1);
if (counts.length !== 3) {
  refuse(
    "the sync printed no search_docs/identity/prose line",
    "The write may have landed. Verify the index by hand before trusting it.",
  );
}
const [docs, identity, prose] = counts;
if (!(docs === identity && identity === prose)) {
  refuse(
    `the search index disagrees with its source: docs=${docs} identity=${identity} prose=${prose}`,
    "Rebuild the indexes. Do NOT `DELETE FROM` either one; the repair is ('rebuild').",
  );
}


/* ------------------------------------------------- 7. the Ask index, last */

/*
 * THE ANSWER INDEX IS THE ONE DERIVED STORE `sync:content` DOES NOT REBUILD.
 *
 * D1 and both FTS indexes are rebuilt above. AI Search is not: the only things
 * that ever wrote it were `savePost`, for a post published through the editor,
 * and a human clicking sync-ask in the admin. So every post that landed by
 * COMMIT left the answer index behind, and this site's writing mostly lands by
 * commit.
 *
 * MEASURED 2026-08-23: the scheduled health check went red four polls running
 * at `expected 91, present 90`, and shipping nine post updates widened it to
 * `expected 99, present 90`, tracking search_docs growth exactly. Nothing was
 * broken; nothing was holding the step.
 *
 * ## WHY THIS RUNS AFTER THE DEPLOY AND FAILS THE RUN ANYWAY
 *
 * It cannot run before: it uploads what the DEPLOYED Worker serves, through
 * that Worker's own bindings. So by the time it can run, the deploy has landed
 * and rolling back on its account would be the wrong trade, because a deployed
 * site with a stale answer index is better than no deploy and the same stale
 * index.
 *
 * So the deploy STANDS, the record below still prints, and ship exits nonzero
 * at the very end. Both surfaces then carry the miss: this output, and the
 * scheduled health poll that will read the same drift fifteen minutes later.
 *
 * The operation is idempotent, so a failed run is safe to repeat: rerunning
 * ship, or calling sync_ask directly, writes the same keys again.
 *
 * ## A MISS IS NOT DECLARED ON THE FIRST READING, since 2026-08-24
 *
 * `syncAsk` reads the counts back immediately after its writes and AI Search is
 * eventually consistent, so the first reading can be early rather than wrong.
 * A non-converged write-back now opens a bounded read-only window against
 * `/api/health` before anything is called a miss. The window, the bound and the
 * reason it re-reads health rather than re-running `sync_ask` are all at the
 * poll itself; what matters here is that NOTHING BELOW CHANGED. A miss that
 * survives the window still exits nonzero, still after the deploy stands, still
 * with the record printed.
 */

announce("Bring the Ask index into step");

/** Set when the Ask index did not converge. Read at the very end. */
let askMiss = "";

/**
 * Set when convergence arrived during the poll window rather than on the
 * write-back read. It exists so the summary line below cannot report the
 * write-back's counts as if they were the converged ones: those numbers are
 * precisely the stale pair the window was opened to outlive.
 */
let askLateConverge = false;

/**
 * ONE AUTHENTICATED OPERATOR CALL, and one statement of what a usable answer is.
 *
 * Shared by the Ask step and the media step since 2026-08-24. Both need the
 * same four refusals in the same order, and a second copy of them would be a
 * second answer to "did this operation prove anything", which is the question
 * ship exits nonzero on. Rule 17.
 *
 * Returns the report and a MISS STRING rather than throwing, because every one
 * of these failures happens AFTER the deploy has landed: the caller has to
 * record the miss and let the deploy stand, never abort.
 *
 * @param {string} tool
 * @returns {Promise<{ report: any, miss: string }>}
 */
async function operatorSync(tool) {
  /** @type {Response | null} */
  let response = null;
  /** @type {any} */
  let body = null;
  let miss = "";

  try {
    response = await fetch(`${ORIGIN}/api/operator`, {
      method: "POST",
      headers: {
        // The token goes in a header on a request this process builds. It is
        // never an argv entry, which every process on the machine can read.
        authorization: `Bearer ${OPERATOR_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ tool, args: {} }),
    });
    body = await response.json().catch(() => null);
  } catch (error) {
    miss = `the ${tool} call did not complete: ${error instanceof Error ? error.message : String(error)}`;
  }

  if (!miss && response && !response.ok) {
    // The status is the story. The token is NOT echoed, and neither is the
    // request; a 401 here means the secret and the file disagree.
    miss = `the operator API answered ${response.status} to ${tool}`;
  }

  const report = body && typeof body === "object" ? (body.data ?? body) : null;
  if (!miss && (!report || typeof report.converged !== "boolean")) {
    miss = `the operator API answered ${tool} without a converged verdict, so nothing was proven`;
  }

  return { report, miss };
}

{
  const { report, miss } = await operatorSync("sync_ask");
  askMiss = miss;

  if (!askMiss && report.converged !== true) {
    /*
     * THE CONVERGENCE WINDOW, ruled 2026-08-24 after a false alarm.
     *
     * `syncAsk` reads `expected` and `present` back IMMEDIATELY after its two
     * writes, and AI Search is eventually consistent, so a drift reported there
     * can be a moment behind rather than a fault. That is not a hypothesis:
     * measured 2026-08-24, ship read drift 1 at 02:20:18Z, NO REMEDY WAS
     * APPLIED, and the scheduled health check read ok 75 seconds later and
     * stayed ok. The index converges on its own inside about a minute, which is
     * upload visibility lag.
     *
     * So the miss is not declared on the first reading. It is declared after
     * the index has been given a window to catch up.
     *
     * ## THE RE-READ IS READ-ONLY, AND THAT IS THE WHOLE DESIGN
     *
     * Polling by calling `sync_ask` again would re-upload the entire corpus,
     * which REPAIRS the thing being measured. A run that then converged could
     * not be distinguished from one that had self-healed, and that exact
     * ambiguity is what the 2026-08-24 watch item recorded as unresolvable.
     *
     * `/api/health` runs `ask-index-drift`, which derives its verdict from the
     * SAME `askIndexStatus()` that `syncAsk` derives `converged` from, and it
     * writes nothing. `publicHealthBody` opts `expected` and `present` onto the
     * wire by name for failing checks, so the counts are readable without a
     * token. Convergence inside this window is therefore evidence of self-heal,
     * not of a remedy this loop applied.
     *
     * ## THE BOUND
     *
     * At most ASK_POLL_ATTEMPTS iterations, AND no iteration begins after the
     * deadline, so the loop cannot outlast the window by more than the single
     * health request already in flight when the deadline passes. Health caps
     * each of its own checks at three seconds. Two independent bounds rather
     * than one, because a `while` on the clock alone would spin without limit
     * if the clock were ever wrong, and a count alone would not honour the
     * stated two minutes if a request hung.
     */
    /** One read-only reading of the deployed ask-index-drift check. */
    const driftReading = async () => {
      const res = await fetch(`${ORIGIN}/api/health`, {
        headers: { "user-agent": "ship", "cache-control": "no-cache" },
      });
      // Parsed regardless of status: health answers 503 when ANY check fails,
      // including ones this loop is not asking about, and the body is still
      // the answer.
      const health = await res.json().catch(() => null);
      return health?.checks?.find((/** @type {any} */ c) => c?.name === "ask-index-drift") ?? null;
    };

    const firstReading =
      `${report.expected} expected, ${report.present} present, drift ${report.drift}`;
    console.log(
      `  not converged on the write-back (${firstReading}). Re-reading /api/health for up ` +
        `to ${ASK_POLL_WINDOW_MS / 1000}s before calling it a miss.`,
    );

    const { converged, polls, latest } = await awaitAskConvergence({
      reading: driftReading,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      onPoll: ({ poll, reading }) => {
        if (!reading) console.log(`  poll ${poll}: health unreadable`);
        else if (!reading.ok)
          console.log(`  poll ${poll}: still behind (${reading.expected} expected, ${reading.present} present)`);
      },
    });

    if (converged) {
      askLateConverge = true;
      console.log(
        `  CONVERGED after ${polls} poll(s), roughly ${polls * (ASK_POLL_INTERVAL_MS / 1000)}s. ` +
          `The write-back read was early, not wrong: nothing was re-uploaded during the ` +
          `window, so the index caught up on its own.`,
      );
    } else {
      const last = latest
        ? `${latest.expected} expected, ${latest.present} present`
        : `health was unreadable on every poll, last write-back reading: ${firstReading}`;
      askMiss =
        `the Ask index did not converge within ${ASK_POLL_WINDOW_MS / 1000}s (${last}), ` +
        `after uploading ${report.uploaded} and removing ${report.removed}`;
    }
  }

  if (askMiss) {
    console.log(`  MISSED: ${askMiss}`);
  } else if (askLateConverge) {
    console.log(
      `  converged inside the window: ${report.uploaded} uploaded, ${report.removed} removed, ` +
        `${report.cacheDropped} cached answer(s) dropped. The counts are deliberately not ` +
        `restated here; the write-back pair was stale and health reported the current one.`,
    );
  } else {
    console.log(
      `  converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.uploaded} uploaded, ${report.removed} removed, ` +
        `${report.cacheDropped} cached answer(s) dropped.`,
    );
  }
}

/* --------------------------------------------- 8. the media index, likewise */

/*
 * THE MEDIA INDEX IS THE THIRD DERIVED STORE, AND IT WAS THE ONE LEFT MANUAL.
 *
 * D1 and both FTS indexes are rebuilt by `sync:content`. The Ask index is
 * brought into step above. The media index was rebuilt by exactly one thing: a
 * person clicking a button in `/admin/media`. So every ship that added or
 * removed a static asset left the index describing the previous build, and the
 * standing repair was a click that waited weeks. `/fonts/OFL.txt` is the
 * measured instance: one public file with no row, red in `check:media --remote`
 * since the fonts landed.
 *
 * Ruled 2026-08-24 under the AUTOMATE directive. The button STAYS, as manual
 * repair; what changes is that the routine case no longer needs it.
 *
 * ## SAME PLACE IN THE ORDER, AND FOR THE SAME REASON
 *
 * After the deploy, because the rebuild runs inside the deployed Worker through
 * its own bindings: it reads the R2 buckets and the ASSETS binding of the build
 * that is actually serving. Running it before would index the previous build's
 * static assets. So, exactly like the Ask step, this cannot run early enough to
 * roll anything back, and a deployed site with a stale media index is better
 * than no deploy and the same stale index.
 *
 * ## NO POLL HERE, DELIBERATELY, AND IT IS NOT AN OVERSIGHT
 *
 * The Ask step waits out a two minute window because AI Search is a separate
 * eventually consistent service. This store is D1: `rebuildMediaIndex` awaits
 * every upsert and delete, and `mediaIndexStatus` reads back inside the SAME
 * Worker request, which reads its own writes. There is no interval in which a
 * correct rebuild reports drift, so a window would only delay a real failure.
 * The reason is written down because the absence of a poll beside a step that
 * has one looks like an omission, and the next reader deserves to know it was a
 * decision. The evidence is the first ship's own output.
 */

announce("Bring the media index into step");

/** Set when the media index did not reconcile. Read at the very end. */
let mediaMiss = "";

{
  const { report, miss } = await operatorSync("sync_media");
  mediaMiss = miss;

  if (!mediaMiss && report.converged !== true) {
    const why = [
      report.missing?.length ? `${report.missing.length} missing` : "",
      report.extra?.length ? `${report.extra.length} extra` : "",
      report.failures?.length ? `${report.failures.length} failed to derive` : "",
    ]
      .filter(Boolean)
      .join(", ");
    mediaMiss =
      `the media index did not reconcile: ${report.expected} expected, ` +
      `${report.present} present${why ? ` (${why})` : ""}, after indexing ` +
      `${report.indexed} and removing ${report.removed}`;
  }

  if (mediaMiss) {
    console.log(`  MISSED: ${mediaMiss}`);
    // The KEYS, not just the counts. A miss naming "1 missing" sends the reader
    // to run a reconciliation by hand; a miss naming the path is the answer.
    for (const key of (report?.missing ?? []).slice(0, 10)) console.log(`    missing: ${key}`);
    for (const key of (report?.extra ?? []).slice(0, 10)) console.log(`    extra:   ${key}`);
    for (const failure of (report?.failures ?? []).slice(0, 10)) console.log(`    failed:  ${failure}`);
  } else {
    console.log(
      `  converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.indexed} indexed, ${report.removed} removed.`,
    );
  }
}

/* ------------------------------- 8b. the check readiness deferred, asserted */

/*
 * RULING 48, THE OTHER HALF. The readiness step reported `content-drift` and
 * did not gate on it, because the D1 sync is what converges that drift and a
 * step that refuses before its own repair is a deadlock. The assertion is here
 * instead, and moving it changes what a failure MEANS rather than weakening it:
 *
 *   - at readiness, a failing `content-drift` meant "the index is behind the
 *     repository", which is the ordinary state of a corpus that has just been
 *     committed and not yet synced, and is exactly what the next steps fix
 *   - here, after `sync:content` has run and reported its own drift table, it
 *     means THE SYNC RAN AND DID NOT CONVERGE, which is a defect
 *
 * A MISS, NOT A REFUSAL, on the same rule the Ask and media steps take: the
 * deploy has landed and the sync has already written, so there is nothing left
 * to protect by refusing, and abandoning the record would cost the reader the
 * one report that says what happened. The exit code at the bottom carries it.
 */
announce("The drift checks readiness deferred, asserted");

/** Set when any deferred check is still failing after its repair step has run. */
let deferredMiss = "";
{
  /*
   * ONE READ FOR ALL THREE, not one per check. Each is asserted after ITS
   * repair step, and this point is after all of them, so a single request
   * satisfies every one. Three requests would also be three chances to trip
   * the endpoint's per-IP limiter, which answers 429 and would read as a
   * failure of the checks rather than of the reader.
   */
  const url = `${ORIGIN}${READINESS_PATH}?ship=${sha}-${step}`;
  /** @type {number} */
  let status = 0;
  /** @type {string} */
  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ship", "cache-control": "no-cache" },
      redirect: "manual",
    });
    status = res.status;
    text = await res.text();
  } catch (error) {
    deferredMiss =
      `${READINESS_PATH} could not be reached after the sync: ` +
      `${error instanceof Error ? error.message : error}`;
  }

  if (!deferredMiss) {
    /*
     * Read with NO deferrals, so every row is the endpoint's own verdict. Only
     * the deferred rows are consulted: the others were gated at readiness, and
     * re-refusing them here would be a second opinion on a question already
     * answered before anything was written.
     *
     * `fts-equality` IS THE CLOSEST CALL AND IS DELIBERATELY NOT HERE. The D1
     * sync rebuilds the FTS index outright, so its repair arguably is a later
     * ship step and the rule above would defer it. Ruling 56 names content,
     * Ask and media, and deferring a fourth check changes what may gate a
     * production write, which is a ruling rather than a session's call. Left
     * gating and raised in the report.
     */
    const verdict = readinessVerdict(status, text, READINESS_PATH);
    const { misses, converged } = deferredMisses(verdict.checks, DEFERRED_CHECKS, READINESS_PATH);
    for (const name of converged) console.log(`  ${name} ok, after ${DEFERRED_CHECKS[name]}.`);
    deferredMiss = misses.join("; ");
  }

  if (deferredMiss) console.log(`  MISS: ${deferredMiss}`);
}

/* -------------------------------------------------------------- 9. record */

announce("Shipped");
console.log(`  commit       ${sha}`);
console.log(`  version      ${version}`);
console.log(`  search index ${docs} records, identity and prose agree`);
console.log(`\n  NOT run by ship: verify-live (bills per Ask probe) and check:all --remote.\n`);

/*
 * THE EXIT CODE IS LAST, AND IT IS NONZERO ON ANY MISS.
 *
 * The record above has already printed, because the deploy landed and saying so
 * is true. What did not happen is a derived index catching up, or the two
 * writers proving they render alike, and a pipeline that reported success on
 * either would be the same green-light-meaning-nothing these steps were added
 * to remove.
 *
 * ALL ARE REPORTED, never just the first. The faults are independent, and a
 * run that printed only the Ask miss would send somebody to re-run ship, watch
 * Ask converge, and never learn about the others. That is the N-1-of-N shape
 * FAILURES.md opens with.
 *
 * Nothing is rolled back. The index operations are idempotent and the drift
 * report's D1 side was already converged by the sync. A render-drift miss
 * reaching here has survived that converge AND a second sync, so it is the
 * defect rather than the ordering artifact, and its remedy is finding what
 * wrote the D1 hash rather than a re-run.
 */
if (askMiss || mediaMiss || renderDriftMiss || watchdogMiss || uptimeMiss || deferredMiss) {
  const behind = [
    askMiss ? "THE ASK INDEX" : "",
    mediaMiss ? "THE MEDIA INDEX" : "",
    renderDriftMiss ? "THE RENDER" : "",
    watchdogMiss ? "THE WATCHDOG" : "",
    uptimeMiss ? "THE UPTIME MONITORS" : "",
    deferredMiss ? "DEFERRED DRIFT" : "",
  ]
    .filter(Boolean)
    .join(" AND ");
  const several =
    [askMiss, mediaMiss, renderDriftMiss, watchdogMiss, uptimeMiss, deferredMiss].filter(
      Boolean,
    ).length > 1;
  console.error(`\n${"!".repeat(64)}`);
  console.error(`  DEPLOYED, BUT ${behind} ${several ? "NEED" : "NEEDS"} ATTENTION.`);
  if (askMiss) console.error(`  ask:      ${askMiss}`);
  if (mediaMiss) console.error(`  media:    ${mediaMiss}`);
  if (renderDriftMiss) console.error(`  render:   ${renderDriftMiss}`);
  if (watchdogMiss) console.error(`  watchdog: ${watchdogMiss}`);
  if (uptimeMiss) console.error(`  uptime:   ${uptimeMiss}`);
  if (deferredMiss) console.error(`  deferred: ${deferredMiss}`);
  console.error(
    `\n  The deploy at ${sha} STANDS and the site is serving it. A stale index\n` +
      `  means Ask can miss recent writing or the media library can misdescribe\n` +
      `  assets until its sync succeeds; both operations are idempotent: re-run\n` +
      `  \`npm run ship\`, or call sync_ask / sync_media on the operator API.\n` +
      `  Render drift here has ALREADY SURVIVED a converge write and a second\n` +
      `  sync, so it is not the benign ordering artifact of ruling 30, which\n` +
      `  clears on the second run and is reported as confirmed benign above.\n` +
      `  Either the sync's write is not taking or something else is writing\n` +
      `  render_hash. Read the two hashes the sync named, and start at what\n` +
      `  wrote the D1 one; a re-run is not the repair.\n\n` +
      `  A WATCHDOG miss is the one line above that is about the WATCHER rather\n` +
      `  than the site: the previously deployed watchdog keeps firing, so the\n` +
      `  site is still watched, by older code. Re-run \`npm run ship\`, or deploy\n` +
      `  it alone with \`npx wrangler deploy -c wrangler.watchdog.jsonc\`.\n\n` +
      `  The watchdog reads the same index drift every fifteen minutes and\n` +
      `  attempts the same repair itself before it alerts; the hourly health.yml\n` +
      `  run is the off-platform second opinion.`,
  );
  console.error(`${"!".repeat(64)}\n`);
  process.exit(1);
}
