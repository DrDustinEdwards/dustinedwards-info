/**
 * Gate: run the Worker test layer, and refuse to believe an empty one.
 *
 *   npm run test:worker
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT RUNS VITEST IN WORKERD AND READS ITS SUMMARY.** It knows how many test
 * files were discovered and how many cases reported pass or fail. It does not
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
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test", "worker");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never
 * summed. Re-taking the measurement means running the gate.
 *
 * Tight rather than slack, on `check:tests`' convention and for its reason:
 * these move UP when somebody adds a case, a one-line edit in the same commit,
 * and the whole point is to notice the set SHRINKING. Each sits at about 94
 * percent of its measurement, so the layer has to lose roughly six percent
 * before this notices. The margin only ever widens on its own, which is the
 * drift `check:tests` recorded happening five times.
 */
/* 5 against 6 measured 2026-08-29 by RUNNING the gate. */
const MINIMUM_FILES = 5;
/* 57 against 61, measured in the same run. The file floor catches a file
   LEAVING; this one catches a file being hollowed out in place, which no file
   count can see. */
const MINIMUM_CASES = 57;

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
 * IT DELEGATES rather than restating the vitest invocation, on the anti-mirror
 * rule `check:types` follows: package.json is the one place that defines what
 * this layer's run IS, and a second spelling here drifts. `npm run test:worker`
 * is also the command a person types, so the gate and the human run the same
 * thing by construction.
 */
const run = spawnSync("npm run test:worker --silent", {
  cwd: root,
  encoding: "utf8",
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

/*
 * Vitest's default reporter prints `Tests  60 passed (60)` and, when something
 * failed, `Tests  2 failed | 58 passed (60)`. The TOTAL in parentheses is the
 * number this gate floors, because it is the one that survives a failure and
 * the one an emptied glob drives to zero.
 *
 * ANCHORED AND BOUNDED. `Tests` also appears in `Test Files`, so the needle
 * requires the word at a line's start after the reporter's indent, and the
 * total is read from the parenthesised group rather than from the first
 * integer on the line, which is the failing count when there is one.
 */
const totals = output.match(/^\s*Tests\s+(.+?)\((\d+)\)\s*$/m);
const total = totals ? Number(totals[2]) : null;
const failedMatch = output.match(/^\s*Tests\s+(\d+)\s+failed/m);
const failed = failedMatch ? Number(failedMatch[1]) : 0;

console.log(`  vitest reported: cases ${total}, failed ${failed}, exit ${run.status}`);

ok(
  "the runner's summary was parseable",
  total !== null,
  "could not read the `Tests ... (N)` summary line, so the count below would be " +
    "asserted against nothing. The reporter format changed.\n        " +
    output.split("\n").slice(-15).join("\n        "),
);
ok(
  "no worker test failed",
  failed === 0 && run.status === 0,
  `${failed} failing, runner exit ${run.status}.\n${output
    .split("\n")
    .filter((l) => /^\s*(FAIL|×)/.test(l))
    .slice(0, 12)
    .join("\n        ")}`,
);
ok(
  "the executed worker case count has not shrunk",
  (total ?? 0) >= MINIMUM_CASES,
  `${total} case(s) executed, expected at least ${MINIMUM_CASES}. Cases were removed, ` +
    `or a file stopped being discovered. Vitest exits 0 on an empty run, which is the ` +
    `whole reason this floor exists.`,
);

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
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 5.`,
  );
}

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
