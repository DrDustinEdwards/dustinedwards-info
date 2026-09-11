/**
 * Gate: run the Worker test layer, and refuse to believe an empty one.
 *
 *   npm run test:worker
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT RUNS VITEST IN WORKERD AND READS ITS SUMMARY.** It knows how many test
 * files were discovered and how many cases the runner's own report counted. It
 * does not
 * know whether those cases ASSERT anything: an empty `it()` body counts as a
 * passing case here exactly as it does for vitest. That class belongs to
 * review.
 *
 * It cannot see the deployed build, which is `verify-live`'s subject, and it
 * cannot see the platform's cache, which is `check:browser`'s. The layer's own
 * boundary, including why the React Router route table is a stub, is stated at
 * length in `vitest.config.ts`.
 *
 * ## Why this exists
 *
 * The 2026-08-29 audit: 487 pure-function tests and a real-browser gate, with
 * NOTHING BETWEEN THEM. No test ran a loader, an action, D1, KV, R2, the Cache
 * API or the Worker, so every route-level fact had to be established by probing
 * production, and three defects reached the wire that this layer catches
 * offline in seconds.
 *
 * ## THE SAME FAILURE MODE AS `check:tests`, AND THE SAME REPAIR
 *
 * **Vitest exits 0 when its `include` glob matches nothing.** A rename, a moved
 * directory, or a config edit would empty this layer and the runner would call
 * it success, which is the exact defect the 2026-08-11 audit found in
 * `check:tests`. So this gate discovers the files itself, floors the count, and
 * floors the executed cases, all before believing an exit code.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test", "worker");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never
 * summed. Re-taking the measurement means running the gate.
 *
 * Tight rather than slack, on `check:tests`' convention and for its reason:
 * these move UP when somebody adds a case, a one-line edit in the same commit,
 * and the whole point is to notice the set SHRINKING.
 *
 * HOW FAR UNDER IS `check:floors`' TO SAY, and it is not restated here. This
 * docblock used to carry "about 94 percent", which is a second owner of a rule
 * that gate enforces, and the two disagreed by one case on the first run after
 * it was written down: 113 satisfied the sentence and failed the gate.
 */
/* 8 against 9, re-measured 2026-09-06 by RUNNING the gate after
   media-events.test.ts landed. It was 7 against 8. One below the measurement,
   so a single file leaving the *.test.ts pattern trips it, which is the
   relationship every pair here has had. */
const MINIMUM_FILES = 8;
/* 114 against 120, re-measured 2026-09-06 by RUNNING the gate after the two
   placeholder cases landed, then corrected from 113 by check:floors, which
   allows a gap of at most 6 at this count. The file floor catches a file
   LEAVING; this one catches a file being hollowed out in place, which no file
   count can see.

   THE PREVIOUS PAIR DID NOT FOLLOW THE CONVENTION ABOVE, and it is corrected
   here rather than carried: the comment recorded "105 against 112" and the
   constant read 112, the measurement itself. That fails in the safe direction
   (it trips on a single case leaving) and it also went stale silently, because
   by today the layer had grown to 118 cases against a floor written for a
   112-case run. Re-run, never adjusted by arithmetic. */
/*
 * RE-MEASURED 2026-09-11 BY RUNNING THE GATE: 127 cases, confirmed identically
 * by CI on a clean checkout. The floor of 114 predates this session; the two
 * test files added to test/worker/ raised the count and pushed the existing gap
 * past what check:floors allows.
 *
 * Executed 127, tolerance 7, lowest legal 120, set to 124.
 *
 * **SET THROUGH check:floors' OWN TOLERANCE, 2026-09-11, after CI caught the
 * first attempt.** That attempt read "six percent under" out of a comment in
 * check-headers.mjs and applied it to four gates. The rule is
 * `max(3, ceil(executed * 0.05))` and it belongs to `scripts/check-floors.mjs`,
 * the gate that enforces it. Prose about a gate ages; the gate does not.
 *
 * It went undetected locally because check:floors runs the whole offline tier
 * and therefore runs LAST, and the tier hangs before it on this host
 * (node --test wedges on test/check-all-cleanup.test.mjs, which predates this
 * work and is proven so by differential). CI reached it on the first push.
 */
const MINIMUM_CASES = 124;

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/** @param {string} dir @param {string[]} out */
function testFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

console.log("\ntest:worker\n");

const files = testFiles(TEST_DIR);
console.log(
  `  discovered ${files.length} file(s): ` +
    files.map((f) => relative(TEST_DIR, f).split(sep).join("/")).join(", "),
);

ok(
  "the worker test glob discovered files at all",
  files.length > 0,
  "test/worker/ holds no *.test.ts. Vitest exits 0 on an empty match, so without " +
    "this the gate would report PASS while running nothing.",
);
ok(
  "the worker test file set has not shrunk",
  files.length >= MINIMUM_FILES,
  `${files.length} file(s), expected at least ${MINIMUM_FILES}. A test file was ` +
    `deleted or renamed out of the *.test.ts pattern.`,
);

/*
 * ## THE COUNTS COME FROM VITEST'S JSON REPORTER, NOT FROM ITS HUMAN OUTPUT
 *
 * **CAUGHT BY CI ON THIS GATE'S FIRST CLEAN-CHECKOUT RUN, 2026-08-29.** The
 * first version read `Tests  61 passed (61)` off the default reporter with an
 * anchored regex.
 *
 * WHAT WAS OBSERVED, and it is deliberately separated from what caused it. The
 * tests RAN in CI and passed: the run exited 0 and the whole log carries the
 * `console.error` lines `routes.test.ts` produces on STDERR. What the log
 * carries nowhere is any of vitest's STDOUT: no `RUN  v` banner, no
 * `Test Files`, no `Tests`, no `Duration`. So the gate read `cases null` and
 * failed closed.
 *
 * **THE CAUSE WAS NOT ESTABLISHED, and this comment does not invent one.** The
 * obvious candidate was checked and REFUTED: re-running the old needle locally
 * with `GITHUB_ACTIONS=true` and `CI=true` still matched, at 61, so vitest
 * swapping reporters under that variable is not it. Whatever ate that stream
 * lives somewhere between the Linux runner, npm and the pool, and it is not
 * reproducible on this machine.
 *
 * That is exactly why the repair is not a better regex. The mistake underneath
 * is hard rule 10's own: the needle was pointed at a HUMAN-FACING RENDERING,
 * which is free to differ per environment and did, in a way nobody has yet
 * explained. The JSON reporter is a CONTRACT instead. `numTotalTests` and
 * `numFailedTests` come off a file this gate names and reads itself, so the
 * class is gone rather than patched, whatever the stream does.
 *
 * BOTH REPORTERS RUN. The default one still reaches the console, because a
 * person reading a failure wants the case name and the diff, and the JSON file
 * costs nothing beside it.
 *
 * IT STILL DELEGATES, on the anti-mirror rule `check:types` follows:
 * package.json defines what this layer's run IS and the flags below only add an
 * output format to it, so `npm run test:worker` stays the command a person
 * types.
 */
const reportDir = mkdtempSync(join(tmpdir(), "check-worker-"));
const reportPath = join(reportDir, "vitest.json");

/** @type {ReturnType<typeof spawnSync> | null} */
let run = null;
/** @type {{ numTotalTests?: number, numFailedTests?: number } | null} */
let report = null;
let reportProblem = "";
try {
  run = spawnSync(
    `npm run test:worker --silent -- --reporter=default --reporter=json --outputFile="${reportPath}"`,
    { cwd: root, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 },
  );
  if (!existsSync(reportPath)) {
    reportProblem = `vitest wrote no report at ${reportPath}`;
  } else {
    try {
      report = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch (error) {
      reportProblem = `the report did not parse: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} finally {
  rmSync(reportDir, { recursive: true, force: true });
}

const output = `${run?.stdout ?? ""}${run?.stderr ?? ""}`;
const total = typeof report?.numTotalTests === "number" ? report.numTotalTests : null;
const failed = typeof report?.numFailedTests === "number" ? report.numFailedTests : 0;

console.log(`  vitest reported: cases ${total}, failed ${failed}, exit ${run?.status}`);

ok(
  "the runner wrote a machine-readable report",
  total !== null,
  `${reportProblem || "the report carried no numTotalTests"}, so the count below ` +
    `would be asserted against nothing.\n        ` +
    output.split("\n").slice(-15).join("\n        "),
);
ok(
  "no worker test failed",
  failed === 0 && run?.status === 0,
  `${failed} failing, runner exit ${run?.status}.\n${output
    .split("\n")
    .filter((l) => /^\s*(FAIL|×)/.test(l))
    .slice(0, 12)
    .join("\n        ")}`,
);
const casesFloorBreach = assertFloor(
  "check:worker",
  "cases",
  total ?? 0,
  MINIMUM_CASES,
  "Cases were removed, or a file stopped being discovered. Vitest exits 0 on an " +
    "empty run, which is the whole reason this floor exists.",
);
ok("the executed worker case count has not shrunk", !casesFloorBreach, casesFloorBreach ?? "");

/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS.
 *
 * MINIMUM_CASES above floors the cases VITEST ran, which is the important
 * number and not this one. This floors the assertions this gate makes ABOUT
 * that run: discovery, the exit code, the parsed totals. If those stopped
 * running, the case floor above would stop being consulted and nothing would
 * say so.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-29 by RUNNING it: 5.
 * Never summed. Slack of ZERO, on `check:tests`' reasoning: this gate asserts a
 * fixed set of properties about one run, so a drop is a removed assertion
 * rather than natural movement, and a rise arrives in the commit that adds one.
 */
const MINIMUM_CHECKS = 5;
const floorBreach = assertFloor("check:worker", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
