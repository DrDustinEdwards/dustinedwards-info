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

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";
const POLL_PATH = "/colophon";
const POLL_COUNT = 5;
const POLL_GAP_MS = 10_000;

let step = 0;

/** @param {string} title */
function announce(title) {
  step += 1;
  console.log(`\n${"=".repeat(64)}\n  ${step}. ${title}\n${"=".repeat(64)}`);
}

/**
 * Refuse, loudly, naming the step and the remedy. Never a bare exit.
 * @param {string} why @param {string} remedy
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
console.log(`  HEAD is ${sha}`);

/* ------------------------------------------------- 1b. unmeasured placeholders */

/*
 * NO STATED-ABSENCE PLACEHOLDER MAY REACH A DEPLOY.
 *
 * The origin-requests panel owes its caption a sentence about whether a cached
 * serve is counted, and that sentence has to come from `npm run ae-probe`
 * rather than from reasoning. Until it does, the panel carries a named
 * placeholder so the gap is visible in the product and asserted by
 * `check:admin-ui`.
 *
 * HERE RATHER THAN IN check:head, deliberately. check:head runs inside the
 * ordinary offline tier, so putting this there would fail every run TODAY,
 * while the placeholder is doing its job correctly. The rule is not "this text
 * must never exist", it is "this text must never SHIP", and ship is the only
 * step that can tell the difference. Smaller diff, and the only one that says
 * the true thing.
 *
 * Removing the placeholder without writing the measured sentence fails
 * check:admin-ui instead, so neither direction is silent.
 */
const PLACEHOLDERS = [
  {
    token: "CACHE_SENTENCE_PENDING_PROBE",
    file: "app/lib/admin/origin-requests.mjs",
    remedy:
      "Run `npm run ae-probe`, write the measured sentence into the caption, and " +
      "delete the constant. The panel must not go live saying the question is " +
      "unanswered.",
  },
];
for (const placeholder of PLACEHOLDERS) {
  const path = join(root, placeholder.file);
  if (!existsSync(path)) continue;
  if (readFileSync(path, "utf8").includes(placeholder.token)) {
    refuse(
      `${placeholder.file} still declares ${placeholder.token}, which is an ` +
        "unmeasured claim standing in for a measured one",
      placeholder.remedy,
    );
  }
}
console.log(`  no unmeasured placeholders (${PLACEHOLDERS.length} checked).`);

/* --------------------------------------------------------------- 2. build */

announce("Build");
if (run("npm", ["run", "build"]).code !== 0) {
  refuse("the build failed", "Fix the build. Nothing was deployed.");
}

/* --------------------------------------------------------------- 3. gates */

announce("Gates, offline tier");
if (run("npm", ["run", "check"]).code !== 0) {
  refuse(
    "a gate is red",
    "Read the table above for the failing gate NAME before retrying. Nothing was deployed.",
  );
}

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

/* ------------------------------------------------------- 6. gate, then sync */

announce("check:content, because sync runs no gate of its own");
if (run("npm", ["run", "check:content"]).code !== 0) {
  refuse(
    "the committed artifact does not match a fresh generation",
    "Run `npm run build:content` and commit the result. NOTHING WAS SYNCED. " +
      "sync-content.mjs would have pushed the stale artifact into production D1.",
  );
}

announce("Sync content to remote D1");
const sync = run("npm", ["run", "sync:content", "--", "--remote"], { capture: true });
if (sync.code !== 0) {
  refuse("the sync failed", "D1 may be partially written. Re-run `npm run ship`.");
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

/* -------------------------------------------------------------- 7. record */

announce("Shipped");
console.log(`  commit       ${sha}`);
console.log(`  version      ${version}`);
console.log(`  search index ${docs} records, identity and prose agree`);
console.log(`\n  NOT run by ship: verify-live (bills per Ask probe) and check:all --remote.\n`);
