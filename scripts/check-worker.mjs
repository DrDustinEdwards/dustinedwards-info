import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { createTally } from "./lib/tally.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test", "worker");

// Measured by running the gate, one below, so a single file leaving the pattern trips it.
const MINIMUM_FILES = 13;
// Catches a file hollowed out in place. Measured by running the gate, a little under the count.
const MINIMUM_CASES = 128;

const tally = createTally();
const { ok } = tally;

console.log("\ntest:worker\n");

const files = walkFiles(TEST_DIR, { keep: (name) => name.endsWith(".test.ts") });
console.log(
  `  discovered ${files.length} file(s): ` +
    files.map((f) => relative(TEST_DIR, f).split(sep).join("/")).join(", "),
);

const filesBreach = assertFloor(
  "check:worker",
  "files",
  files.length,
  MINIMUM_FILES,
  "A test file was deleted or renamed out of the *.test.ts pattern.",
);
ok("the worker test file set has not shrunk", filesBreach === null, filesBreach ?? "");

// Counts come from the JSON reporter: the human output is free to differ per environment, and on CI
// it carried no counts at all.
const reportDir = mkdtempSync(join(tmpdir(), "check-worker-"));
const reportPath = join(reportDir, "vitest.json");

/** @type {ReturnType<typeof spawnSync> | null} */
let run = null;
/**
 * @type {{
 *   numTotalTests?: number,
 *   numFailedTests?: number,
 *   testResults?: Array<{
 *     name?: string,
 *     message?: string,
 *     assertionResults?: Array<{ status?: string, fullName?: string, failureMessages?: string[] }>,
 *   }>,
 * } | null}
 */
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

/**
 * The failing cases by name, from the report: the human output's FAIL lines carry colour codes and
 * glyphs that differ by environment, and filtering them printed a count on CI with no case to read.
 *
 * @param {string | undefined} text
 */
const firstLines = (text) => String(text ?? "").split("\n").slice(0, 6).join("\n          ");
const failures = (report?.testResults ?? []).flatMap((file) => {
  const where = relative(root, file.name ?? "");
  const cases = (file.assertionResults ?? [])
    .filter((result) => result.status === "failed")
    .map((result) => `${where} > ${result.fullName}\n          ${firstLines(result.failureMessages?.[0])}`);
  // A file that failed to load has no cases, only its message.
  if (cases.length > 0) return cases;
  return file.message ? [`${where}: ${firstLines(file.message)}`] : [];
});

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
  `${failed} failing, runner exit ${run?.status}.\n        ${failures.slice(0, 12).join("\n        ")}`,
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

console.log(`\n${tally.checks} checks, ${tally.failures} failures\n`);
process.exit(tally.failures > 0 ? 1 : 0);
