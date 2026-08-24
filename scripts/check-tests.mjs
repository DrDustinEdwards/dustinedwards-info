/**
 * Gate: run the behavioural test suite, and refuse to believe an empty one.
 *
 *   npm run check:tests
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT RUNS `node --test` AND READS ITS SUMMARY.** It knows how many test files
 * were discovered and how many tests reported pass or fail. It does not know
 * whether those tests ASSERT anything: a file full of `test("x", () => {})`
 * bodies counts as passing tests here, exactly as it does for node. That class
 * belongs to review, and to `check:assertions` for the gates.
 *
 * It also cannot see whether the tests cover the right modules. Six files
 * covering two of the ten `scripts/lib/` modules is the current state and this
 * gate is content with it; coverage is a judgement, not a count.
 *
 * ## Why this exists
 *
 * The external audit of 2026-08-11. `check:tests` was `npm test --silent`,
 * which is `node --test "test/**\/*.test.mjs"`, and **node exits 0 when the
 * glob matches nothing**. Measured, by changing the glob to `*.spec.mjs`, which
 * is what renaming the files would do:
 *
 *   baseline      tests 43, pass 43, EXIT=0
 *   glob broken   tests  0, pass  0, EXIT=0
 *   exit code seen by check-all: 0 -> PASS
 *
 * Every hand-written gate in this repo fails closed on an empty scope. This one
 * structurally could not, because it delegated to a runner whose "nothing to
 * do" is success. It is the only gate asserting BEHAVIOUR of shipped modules,
 * so its silent emptying is the most expensive one available.
 *
 * FAILS CLOSED on zero files, on fewer files than are committed, and on fewer
 * tests than have been measured.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY on 2026-08-24 by RUNNING
 * it: 42 files, 426 tests. Never summed.
 *
 * **BOTH HAD DRIFTED INTO THE UNFAILABLE CLASS, and this is the gate where that
 * costs the most.** They were 23 and 237 against 40 and 389: seventeen test
 * FILES and a hundred and fifty-two TESTS could have been deleted with this
 * gate, the one instrument in the suite that asserts BEHAVIOUR, reporting a
 * clean run. The floors had last moved when `artifact-once-per-request` landed
 * and were never re-measured across everything after it.
 *
 * The drift is not new and the changelog that used to sit here recorded five
 * earlier rounds of it, each with the same shape and the same resolution. That
 * changelog is deleted rather than extended: it was six stale numbers arguing
 * for a discipline the numbers themselves did not follow, which is rule 17's
 * own subject. **The measurement is the two constants below and this comment
 * points at how to retake it, which is to run the gate.**
 *
 * Tight rather than slack, deliberately, and that is this gate's own
 * convention rather than the suite's: these move UP when somebody adds a test,
 * a one-line edit in the same commit, and the whole point is to notice the set
 * SHRINKING. Both floors are 94 percent of their own measurement, narrow
 * enough that losing the smallest test file still trips the file floor.
 */
const MINIMUM_FILES = 39;
/* 400 against 426 measured. The file floor above catches a file LEAVING; this
   one catches a file being hollowed out in place, which no file count can see. */
const MINIMUM_TESTS = 400;

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
    else if (entry.endsWith(".test.mjs")) out.push(full);
  }
  return out;
}

console.log("\ncheck:tests\n");

const files = testFiles(TEST_DIR);
console.log(
  `  discovered ${files.length} file(s): ` +
    files.map((f) => relative(TEST_DIR, f).split(sep).join("/")).join(", "),
);

ok(
  "the test glob discovered files at all",
  files.length > 0,
  "test/ holds no *.test.mjs. node --test exits 0 on an empty match, so without " +
    "this the gate would report PASS while running nothing.",
);
ok(
  "the test file set has not shrunk",
  files.length >= MINIMUM_FILES,
  `${files.length} file(s), expected at least ${MINIMUM_FILES}. A test file was ` +
    `deleted or renamed out of the *.test.mjs pattern.`,
);

const run = spawnSync("npm", ["test", "--silent"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

/** node --test prints `# tests 43` / `ℹ tests 43` depending on reporter. */
const read = (/** @type {string} */ key) => {
  const m = output.match(new RegExp(`^[#ℹ]\\s*${key}\\s+(\\d+)`, "m"));
  return m ? Number(m[1]) : null;
};

const total = read("tests");
const passed = read("pass");
const failed = read("fail");

console.log(`  node --test reported: tests ${total}, pass ${passed}, fail ${failed}`);

ok(
  "the runner's summary was parseable",
  total !== null && passed !== null && failed !== null,
  "could not read the tests/pass/fail summary, so the counts below would be " +
    "asserted against nothing. The reporter format changed.",
);
ok(
  "no test failed",
  failed === 0 && run.status === 0,
  `${failed} failing, runner exit ${run.status}.\n${output.split("\n").filter((l) => /^not ok|✖/.test(l)).slice(0, 10).join("\n        ")}`,
);
ok(
  "the executed test count has not shrunk",
  (total ?? 0) >= MINIMUM_TESTS,
  `${total} test(s) executed, expected at least ${MINIMUM_TESTS}. Tests were removed, ` +
    `or a file stopped being discovered. node exits 0 on an empty run, which is the ` +
    `whole reason this floor exists.`,
);

/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS.
 *
 * MINIMUM_TESTS above floors the tests NODE ran, which is the important number
 * and not this one. This floors the handful of assertions this gate makes ABOUT
 * that run: discovery, the exit code, the reported totals. If those stopped
 * running, the test floor above would stop being consulted and nothing would
 * say so.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 5.
 * Never summed. Floored at 5, slack of ZERO, which is justified here and almost
 * nowhere else: this gate asserts a fixed set of properties about one run, so a
 * drop is a removed assertion rather than natural movement, and a rise arrives
 * in the commit that adds one.
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
