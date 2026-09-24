/**
 * Gate: run the Worker test layer, and refuse to believe an empty one.
 *
 *   npm run test:worker
 *
 * BOUNDARY: **IT RUNS VITEST IN WORKERD AND READS ITS SUMMARY**, so it knows how many files were
 * discovered and how many cases the runner counted, not whether those cases ASSERT anything.
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
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it. Tight rather than slack, on
 * `check:tests`' convention: they move UP with a case, and the point is to notice the set
 * SHRINKING.
 */
/* One below the measurement, so a single file leaving the pattern trips it. */
const MINIMUM_FILES = 11;
/*
 * The file floor catches a file LEAVING; this catches one hollowed out in place. Re-run, never
 * adjusted by arithmetic.
 */
/* Measured by running the gate, a little under the count. */
const MINIMUM_CASES = 130;

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
/*
 * THROUGH assertFloor: the worker test set only ever grows, so the measured value climbs away by
 * itself. As a bare assertion it printed no floor line and the meta-gate had nothing to read.
 */
const filesBreach = assertFloor(
  "check:worker",
  "files",
  files.length,
  MINIMUM_FILES,
  "A test file was deleted or renamed out of the *.test.ts pattern.",
);
ok("the worker test file set has not shrunk", filesBreach === null, filesBreach ?? "");

/*
 * THE COUNTS COME FROM THE JSON REPORTER, NOT FROM THE HUMAN OUTPUT. The first version read the
 * totals off the default reporter, and CI's first clean-checkout run caught it: the tests passed
 * and the log carried none of the runner's stdout, so the gate read no count and failed closed.
 * **THE CAUSE WAS NOT ESTABLISHED, and this comment does not invent one**; the obvious candidate
 * was REFUTED. Which is why the repair is not a better regex: the needle was pointed at a
 * HUMAN-FACING RENDERING, free to differ per environment, which is the vacuity rule's own mistake.
 * BOTH REPORTERS RUN, and IT STILL DELEGATES: package.json defines what this layer's run IS.
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
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS: if those stopped, the case floor would stop
 * being consulted and nothing would say so. Slack of ZERO, a fixed set of properties about one run.
 */
const MINIMUM_CHECKS = 5;
const floorBreach = assertFloor("check:worker", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
