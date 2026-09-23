/**
 * One command that ships: gates, deploy, prove it, sync.
 *
 *   npm run ship
 *
 * Deploy before sync, so `llms.txt` never advertises unserved pages. `check:content` before
 * sync, because `sync-content.mjs` runs no gate. Every step fails closed. A missing Version ID
 * or sync line exits nonzero. `verify-live` stays separate: its probes are billed.
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
import { tierOutcome } from "./lib/tier-outcome.mjs";
import { applyCommand, readMigrationList } from "./lib/pending-migrations.mjs";
import { SITE_ORIGIN } from "../app/lib/seo.ts";
import {
  SHIP_BUSY_NEEDLES,
  busyProcesses,
  readProcessTable,
} from "./lib/child-processes.mjs";
import {
  DEFERRED_CHECKS,
  deferredMisses,
  readinessLines,
  readinessVerdict,
} from "./lib/readiness.mjs";
import { retryRead } from "./lib/retry.mjs";
import { driftCount, searchCounts } from "./lib/sync-verdict.mjs";
import {
  ASK_POLL_INTERVAL_MS,
  ASK_POLL_WINDOW_MS,
  awaitAskConvergence,
} from "./lib/ask-converge.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------ ship's own transcript --- */

/**
 * Gitignored: an untracked log would make the next ship refuse a dirty tree, and the log
 * carries account-scoped ids.
 */
const LOG_DIR = join(root, ".ship-logs");

/** Pruned by age, never by count: ship's write rate varies, so a count is no fixed duration. */
const LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Re-execs ship with piped stdio and tees every chunk to the terminal and the log.
 * Children run with inherited stdio, so wrapping `console` would miss their output.
 * Records what was printed only; it proves nothing about the running Worker.
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

  /* Printed last and only on failure, where a reader scrolling back finds it first. */
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

/* Imported from `app/lib/seo.ts`, never restated: a stale copy would poll the wrong host. */
const ORIGIN = SITE_ORIGIN;
const POLL_PATH = "/colophon";
const POLL_COUNT = 5;
const POLL_GAP_MS = 10_000;

/** `check:policy` asserts this endpoint and that the step runs between deploy and sync. */
const READINESS_PATH = "/api/health";


let step = 0;

/** @param {string} title */
function announce(title) {
  step += 1;
  console.log(`\n${"=".repeat(64)}\n  ${step}. ${title}\n${"=".repeat(64)}`);
}

/**
 * Refuse, naming the step and the remedy, and exit.
 *
 * @param {string} why @param {string} remedy
 * @returns {never}
 */
function refuse(why, remedy) {
  console.error(`\n  REFUSED at step ${step}: ${why}\n  ${remedy}\n`);
  process.exit(1);
}

/**
 * THE SIGNAL IS RETURNED, not collapsed. `status ?? 1` reads a killed process as exit 1, which is
 * how a tier that died under memory pressure reached ship as a gate verdict and got reported as
 * one. A caller that does not care may go on reading `code` alone.
 *
 * @param {string} command @param {string[]} args
 */
function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  const signal = result.signal ?? null;
  if (capture) {
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    process.stdout.write(text);
    return { code: result.status ?? 1, signal, text };
  }
  return { code: result.status ?? 1, signal, text: "" };
}

/**
 * Runs a long command, streaming its output THROUGH while keeping a copy.
 *
 * The tier takes minutes and whoever is watching ship needs to see it move, so `capture`, which
 * withholds everything until the end, is not usable here. But ship has to READ the output to tell
 * a tier that reported from one that did not, so streaming and capturing are the same pass.
 *
 * @param {string} command @param {string[]} args
 * @returns {Promise<{ code: number | null, signal: string | null, text: string }>}
 */
function runStreaming(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });
    let text = "";
    /** @param {Buffer} chunk */
    const tee = (chunk) => {
      const piece = chunk.toString();
      text += piece;
      process.stdout.write(piece);
    };
    child.stdout?.on("data", tee);
    child.stderr?.on("data", tee);
    /* A spawn that never started emits no exit; it must still resolve or ship hangs here. */
    child.on("error", (error) => {
      text += `\nship could not spawn ${command}: ${error.message}\n`;
      resolve({ code: null, signal: null, text });
    });
    child.on("close", (code, signal) => resolve({ code, signal, text }));
  });
}

/* ---------------------------------------------------------------- 1. tree */


/*
 * Checked before the build, so a missing token costs no deploy. Never an argument or printed.
 * The length floor matches `auth.server.ts`.
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

/* ------------------------------------------------------------ 0. preflight */

/*
 * Pull `--ff-only`: a merge commit has no CI run. Refuse while another run holds build/client,
 * matched by command line, never by name (all are `node`). Never killed: whose run is unknown.
 */
announce("Preflight: up to date, and nothing else holding the tree");

{
  const beforePull = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  if (beforePull.status !== 0) refuse("git status failed", "Is this a git repository?");
  const dirtyNow = (beforePull.stdout ?? "").trim();
  if (dirtyNow.length > 0) {
    console.error(dirtyNow);
    refuse(
      "the working tree is not clean, so it cannot be fast-forwarded",
      "Commit or stash first. Nothing has been pulled, built or deployed.",
    );
  }

  const pulled = spawnSync("git", ["pull", "--ff-only"], { cwd: root, encoding: "utf8" });
  const pullOut = `${pulled.stdout ?? ""}${pulled.stderr ?? ""}`.trim();
  if (pulled.status !== 0) {
    console.error(pullOut);
    refuse(
      "git pull --ff-only refused",
      "The branch is not a fast-forward of its upstream, so somebody has landed " +
        "work this clone cannot reach by moving forward. Rebase or merge by hand " +
        "and run ship again. Nothing has been built or deployed.",
    );
  }
  console.log(`  ${pullOut.split("\n")[0] || "already up to date"}`);

  /* Needles live in `child-processes.mjs` so the test imports the list ship uses. */
  const table = readProcessTable();
  if (table.size === 0) {
    /* Cannot verify is not clear: say so rather than pass silently. */
    console.log("  could not read the process table, so nothing was proven about orphans.");
  } else {
    const busy = busyProcesses(table, SHIP_BUSY_NEEDLES, process.pid);
    if (busy.length > 0) {
      console.error(busy.map(({ pid, what }) => `    pid ${pid}  ${what}`).join("\n"));
      refuse(
        `${busy.length} process(es) that write the build or the database are still alive`,
        "Ship reads build/client and writes production D1; a gate run doing the same " +
          "thing underneath it is how EBUSY and a half-written build happen. These are " +
          "REPORTED rather than killed, because ship does not know whose run they are. " +
          "Stop them, or wait, then run ship again. Nothing has been built or deployed.",
      );
    }
    console.log(`  ${table.size} process(es) scanned, none of them a gate run or a preview.`);
  }
}

announce("Working tree must be clean");

/* Checked again after the pull: a failed pull can leave files, and this is what gets built. */
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
// Full sha: `head_sha=` returns nothing for an abbreviated one.
const headFull = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
const shaFull = (headFull.stdout ?? "").trim();
console.log(`  HEAD is ${sha}`);

/*
 * NEVER PUT THE STATED-ABSENCE PLACEHOLDERS LOOP BACK. It iterated an empty array and printed
 * that nothing had been checked, kept as a mechanism for a successor that never came: a dead
 * loop kept for a hypothetical is a shape, not a mechanism. Writing it again with a real
 * subject in hand produces a better check than reviving a generalization drawn from one case.
 * The property it guarded is not lost, and is asserted on the rendered page by check:admin-ui.
 */

/* ------------------------------------------------- 1b. CI's verdict, early */

/*
 * Green CI for this sha skips the local tier. This read picks a path, never a deploy:
 * non-green takes the local path, and the read at step 4 decides.
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
 * The repo is private, so an unauthenticated read answers 404. The token comes from
 * `gh auth token`; without it the CI step refuses.
 */
const ghToken = (() => {
  const t = spawnSync("gh", ["auth", "token"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  return t.status === 0 ? (t.stdout ?? "").trim() : "";
})();

/**
 * One read of GitHub's verdict on HEAD. Returns rather than refuses because the two callers
 * want opposite things; a `shouldRefuse` flag is the shape hard rule 10 names.
 *
 * The verdict shape is `ciVerdict`'s, read off it rather than restated: this copy had already
 * gone stale against the real one, which is what hard rule 17 is about.
 *
 * @returns {Promise<{ verdict: ReturnType<typeof ciVerdict> | null, error: string }>}
 */
async function readCi() {
  try {
    /*
     * A read, so `retryRead` may retry a transient; the final failure still reaches the catch
     * so each caller decides.
     */
    const runs = await retryRead(
      () => fetchCiRuns({ owner, repo, sha: shaFull, token: ghToken }),
      { label: `ship CI read for ${sha}` },
    );
    return { verdict: ciVerdict(runs, sha), error: "" };
  } catch (error) {
    return { verdict: null, error: error instanceof Error ? error.message : String(error) };
  }
}

console.log(`  reading CI for ${owner}/${repo}@${sha} (${ghToken ? "authenticated" : "unauthenticated"})`);
let early = await readCi();

/*
 * A RUN IN FLIGHT IS WORTH WAITING FOR. Falling straight through to the local tier meant racing
 * CI to grade the same commit, on the host where the parallel tier is the thing that dies; CI is
 * read again at the green step regardless, so the local run was work whose result could not
 * authorize anything. Branching on `state` rather than on the wording of `why`, which would make
 * ci-status.mjs's prose an interface.
 *
 * Bounded, and the bound expires into the OLD behavior rather than into a refusal: a slow queue
 * is not a reason to refuse a deploy that the green step is about to judge anyway.
 */
const CI_WAIT_MS = 15 * 60 * 1000;
const CI_POLL_MS = 30 * 1000;
if (early.verdict?.state === "running") {
  const deadline = Date.now() + CI_WAIT_MS;
  console.log(`  ${early.verdict.why}. Waiting up to ${CI_WAIT_MS / 60000} minutes for it.`);
  console.log("  the local tier is not run in its place: it would grade the same commit twice.");
  while (early.verdict?.state === "running" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, CI_POLL_MS));
    early = await readCi();
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    console.log(`  CI is ${early.verdict?.state ?? `unreadable: ${early.error}`} (${left}s left)`);
  }
  if (early.verdict?.state === "running") {
    console.log("  CI did not finish inside the wait. Falling back to the local path.");
  }
}

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
 * No migration may be pending when a deploy goes out. It refuses and never applies: ship cannot
 * tell an additive migration from a destructive one. Pending or unreadable both refuse.
 */

announce("The deployed database has every migration");

const DATABASE = "dustinedwards";

/*
 * `readMigrationList` never throws, so the wrapper throws on `unreadable` only. `pending`
 * is a real answer and is not retried.
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
/* Gitignored and imported statically by routes, so it is built before the app build. */
if (run("npm", ["run", "build:stack"]).code !== 0) {
  refuse("the stack artifact build failed", "Fix build:stack. Nothing was deployed.");
}
/* Gitignored and imported by `about.tsx`; reads stack.json, so it runs after build:stack. */
if (run("npm", ["run", "build:content"]).code !== 0) {
  refuse("the content build failed", "Fix build:content. Nothing was deployed.");
}
/*
 * Nothing imports the twins, so the build passes without them and `llms.txt` would
 * advertise 404s.
 */
if (run("npm", ["run", "build:publication-twins"]).code !== 0) {
  refuse(
    "the publication twin build failed",
    "Fix build:publication-twins. Nothing was deployed.",
  );
}
// The enhancement bundles next: the app build's ?url imports name files under
// the gitignored app/enhance/dist/, so a build without this step fails on a
// missing file that is not the tree's fault.
if (run("npm", ["run", "build:enhance"]).code !== 0) {
  refuse("the enhancement bundle build failed", "Fix build:enhance. Nothing was deployed.");
}
/* This build feeds only `check:page-payload`; `npm run deploy` builds what ships. */
if (ciGreenEarly) {
  console.log("  skipped: react-router build. Its only local reader is the tier below, which CI ran.");
  console.log("  the deploy builds the bundle it ships, on this path and on the other one.");
} else if (run("npm", ["run", "build"]).code !== 0) {
  refuse("the build failed", "Fix the build. Nothing was deployed.");
}

/* --------------------------------------------------------------- 3. gates */

announce("Gates, offline tier");
if (ciGreenEarly) {
  console.log(`  skipped: CI ran this tier on a clean checkout of ${sha}.`);
  console.log("  re-read below, and a CI that is no longer green refuses there.");
} else {
  /*
   * A RED GATE AND A DEAD TIER BOTH REFUSE, and they are told apart before either is worded.
   * This refusal used to say "a gate is red, read the table above" on both paths, and on the
   * crash path there was no table and no gate, the tier having been killed. Same direction,
   * and the message now matches the fact. The decision is `tierOutcome`, which runs nothing.
   */
  const outcome = tierOutcome(await runStreaming("npm", ["run", "check"]));
  if (outcome.state !== "passed") refuse(outcome.why, outcome.remedy);
  console.log(`  ${outcome.why}`);
}

/* ------------------------------------------------------------- 4. CI green */

/*
 * No run, a run in progress, any non-success, or an unreachable API refuses. No `--force`:
 * it would be used on the day the check was right.
 */

announce("CI must be green for this exact commit");

/*
 * Read fresh on every path, never reused from the early read, so no deploy is authorized by
 * a stale verdict.
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
 * A 200 from `/colophon` is not health. Runs after the poll so the new build answers, and
 * before the sync, the first write. `ok` is read from the body; a 429 is reported apart.
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

  /* A failing deferred check is printed, not refused; it is asserted after its repair step. */
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
 * After readiness, so the watchdog is never pointed at an unproven build. A failure is a miss,
 * not a refusal: the site deploy has landed, and ship exits nonzero at the end.
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
    /* No version ID in the output means the deploy is unproven, even on exit 0. */
    const watchdogVersion =
      (deployed.text.match(/Current Version ID:\s*([0-9a-f-]{8,})/i) ?? [])[1] ?? "";
    if (!watchdogVersion) {
      watchdogMiss =
        "the watchdog deploy reported no Version ID, so nothing proves which build is " +
        "now on the cron";
    } else {
      console.log(`  watchdog version ${watchdogVersion}`);
      /* Read back from wrangler: a configured cron is not a registered one. A miss, not a refusal. */
      if (!/schedule|cron|trigger/i.test(deployed.text)) {
        watchdogMiss =
          "the watchdog deployed but wrangler's output named no cron trigger, so the " +
          "schedule may not be registered and the Worker would never fire";
      }
    }
  }

  if (watchdogMiss) console.log(`  MISSED: ${watchdogMiss}`);
}

/* After readiness, like the watchdog. URLs derive from `SITE_ORIGIN`. A failure is a miss. */
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
    /* The change count is read, never inferred from exit 0. */
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

/* Rebuilt so the sync reads this ship's build, not whatever a previous run left. */
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
/** The sync that wrote last, whose output is the verdict: the confirming run when there was one. */
let standing = sync;
if (sync.code !== 0) {
  /*
   * Render drift finishes every write and stands as a miss; any other nonzero refuses.
   * Told apart by the drift line's count, since the exit code carries one bit.
   */
  const drift = driftCount(sync.text);
  if (drift !== null && drift > 0) {
    const slugs = sync.text.match(/RENDER DRIFT on \d+ slug\(s\): ([^.]*)\./);
    const named = slugs ? slugs[1] : "unnamed slug(s)";

    /*
     * First-run drift is usually the old Worker's poll writing an old-renderer hash. A second
     * sync reads zero unless the converge write did not take, so only confirmed drift fails.
     */
    console.log(`  render drift on ${named}: converged, confirming with a second sync`);
    const confirm = run("npm", ["run", "sync:content", "--", "--remote"], { capture: true });
    standing = confirm;
    const confirmDrift = driftCount(confirm.text);

    if (confirmDrift === null) {
      refuse(
        "the confirming sync did not report a drift line",
        "The first sync converged D1 and the second could not be read, so whether " +
          "the drift cleared is UNKNOWN. Re-run `npm run ship`.",
      );
    } else if (confirmDrift === 0) {
      if (confirm.code !== 0) {
        refuse("the confirming sync failed", "D1 may be partially written. Re-run `npm run ship`.");
      }
      console.log(
        `  confirmed benign: the second sync reads render-drift=0, so D1 carried a ` +
          `render from the previously deployed Worker (ruling 30) and the converge ` +
          `write took. Not a pipeline defect.`,
      );
    } else {
      renderDriftMiss =
        `render drift on ${named} SURVIVED a converge write: the first sync wrote ` +
        `the build's render to every row and a second sync still reads ` +
        `render-drift=${confirmDrift}. This is not the ordering artifact of ruling ` +
        `30, which clears on the second run. Either the write is not taking or ` +
        `something is rewriting render_hash behind the sync.`;
      console.log(`  MISSED: ${renderDriftMiss}`);
    }
  } else {
    refuse("the sync failed", "D1 may be partially written. Re-run `npm run ship`.");
  }
}

/*
 * The counts line is the proof, read from the sync that wrote last. `COUNT(*)` on an FTS index
 * reads through to its content table.
 */
const counts = searchCounts(standing.text);
if (!counts) {
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
 * `sync:content` does not rebuild AI Search. It uploads through the deployed Worker, so a miss
 * leaves the deploy standing.
 */

announce("Bring the Ask index into step");

/** Set when the Ask index did not converge. Read at the very end. */
let askMiss = "";

/** True when convergence came during the poll window, so the write-back counts are not reported. */
let askLateConverge = false;

/**
 * One authenticated operator call, shared by the Ask and media steps. Returns a miss string
 * rather than throwing, because every failure here happens after the deploy has landed.
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

  /*
   * A NAMED FAILURE IS A MISS NOW, not a drift to wait out: those keys were never written, so the
   * index will not catch up on its own. It was waited out once, 2026-09-23, and stayed 156 of 157.
   */
  if (!askMiss && Array.isArray(report.failed) && report.failed.length > 0) {
    askMiss =
      `the Ask upload failed for ${report.failed.length} key(s) after retries: ` +
      report.failed.map((/** @type {any} */ f) => `${f.key} (${f.error})`).join(", ") +
      `. Re-run sync_ask once the cause clears`;
  } else if (!askMiss && report.converged !== true) {
    /*
     * AI Search is eventually consistent, so drift is re-read before it is a miss. The re-read is
     * `/api/health`, which writes nothing; `sync_ask` would repair what it measures. Bounded by
     * count and deadline.
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

/* After the deploy, since the rebuild reads the serving build. No poll: D1 reads its own writes. */

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
 * Deferred checks are asserted here, after their repair: refusing before the sync would
 * deadlock. A failure here means the sync did not converge. A miss, not a refusal.
 */
announce("The drift checks readiness deferred, asserted");

/** Set when any deferred check is still failing after its repair step has run. */
let deferredMiss = "";
{
  /* One read for all: more requests risk the per-IP limiter's 429. */
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
     * Only deferred rows are consulted; the rest were gated at readiness. `fts-equality` still
     * gates at readiness: deferring another check needs a ruling.
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

/* Nonzero on any miss, after the record. Every miss is named: the faults are independent. */
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
