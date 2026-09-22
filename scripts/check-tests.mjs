/**
 * Gate: run the behavioral test suite, and refuse to believe an empty one.
 *
 *   npm run check:tests
 *
 * BOUNDARY: it runs `node --test` and reads its SUMMARY, so it knows how many files were
 * discovered and how many tests reported, not whether those tests ASSERT anything and not whether
 * they cover the right modules.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never summed. TIGHT RATHER
 * THAN SLACK, this gate's own convention: they move UP with a test, a one-line edit in the same
 * commit, and the point is to notice the set SHRINKING. The margin only ever widens on its own.
 */
/* Re-taken by running the gate whenever a test file lands. */
/*
 * RE-MEASURED BY RUNNING THIS GATE, never by adding one. This floor once drifted eleven files
 * without failing, being asserted directly rather than through `assertFloor`, so the one floor
 * here the meta-gate could not police is the one that drifted.
 */
const MINIMUM_FILES = 86;
/*
 * RE-MEASURED BY RUNNING THIS GATE. The file floor catches a file LEAVING; this catches one
 * hollowed out in place. Moved when the set grows even if nothing has breached, because waiting
 * for a breach is waiting for the margin to be gone.
 */
const MINIMUM_TESTS = 838;

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

/**
 * BY COMMAND LINE, NEVER BY IMAGE NAME: `node.exe` here selects this gate, the language server
 * and the agent harness. Windows only, that being where the leak was measured.
 *
 * @returns {number[]} the pids killed
 */
function reapTestRunners() {
  if (process.platform !== "win32") return [];
  const script =
    "Get-CimInstance Win32_Process | " +
    "Where-Object { $_.CommandLine -match '--test' -and $_.CommandLine -match 'test/\\*\\*' } | " +
    "ForEach-Object { $_.ProcessId; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  const found = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8", timeout: 30_000 },
  );
  return `${found.stdout ?? ""}`
    .split("\n")
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

/**
 * The five slowest tests, so a creeping hang is visible BEFORE it is a timeout: the suite went
 * from minutes to never in one commit with no duration printed. READS WHATEVER REPORTER RAN,
 * both parsed rather than one assumed, the choice not being this gate's.
 *
 * @param {string} text the runner's combined output
 * @returns {Array<{ ms: number, name: string }>}
 */
function slowestTests(text) {
  /** @type {Array<{ ms: number, name: string }>} */
  const timed = [];

  // tap: `ok 3 - the name` then, a line or two later, `  duration_ms: 1234.5`
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].match(/^(?:not )?ok \d+ - (.+?)\s*$/);
    if (!head) continue;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j += 1) {
      const dur = lines[j].match(/^\s*duration_ms:\s*([\d.]+)/);
      if (dur) {
        timed.push({ ms: Number(dur[1]), name: head[1] });
        break;
      }
    }
  }

  // spec: `✔ the name (1234.5678ms)`
  if (timed.length === 0) {
    for (const line of lines) {
      const m = line.match(/^\s*[✔✖]\s+(.*?)\s+\(([\d.]+)ms\)\s*$/);
      if (m) timed.push({ ms: Number(m[2]), name: m[1] });
    }
  }

  /*
   * DEDUPED BY NAME, longest reading kept: a FAILING test appears twice in tap output and took two
   * of the five slots.
   */
  const longest = new Map();
  for (const t of timed) {
    const seen = longest.get(t.name);
    if (!seen || t.ms > seen.ms) longest.set(t.name, t);
  }

  return [...longest.values()].sort((a, b) => b.ms - a.ms).slice(0, 5);
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
/*
 * THROUGH assertFloor, because A SCOPE FLOOR OVER A GROWING SET IS AN EXECUTED-COUNT FLOOR
 * WEARING DIFFERENT CLOTHES: the measured value climbs away by itself. NOT EVERY SCOPE FLOOR
 * BELONGS HERE, or the instrument agrees with everything: GROWING is the property, not SCOPE.
 */
const filesBreach = assertFloor(
  "check:tests",
  "files",
  files.length,
  MINIMUM_FILES,
  "A test file was deleted or renamed out of the *.test.mjs pattern.",
);
ok("the test file set has not shrunk", filesBreach === null, filesBreach ?? "");

/**
 * THE RUN IS BOUNDED, TWICE, AND IT REAPS WHAT IT STARTED: a leaked child once left the runner
 * unable to exit and this gate waited with it forever. `--test-timeout` reports a hang as a
 * FAILING TEST, by name; the spawn timeout is the backstop for what that cannot see, and is what
 * actually happened. `SIGKILL` rather than `SIGTERM`: it has demonstrated it will not leave.
 */
const TEST_TIMEOUT_MS = 60_000;

/*
 * THE SPAWN BOUND IS LOAD-BEARING, and a plant proved it. Against one file the runner's own bound
 * gets the process out; against the whole suite it did not, because a canceled test's `finally`
 * never runs and the child survives. So one names the culprit and the other ends the run.
 */
const RUN_TIMEOUT_MS = 6 * 60_000;

const run = spawnSync(
  "npm",
  ["test", "--silent", "--", `--test-timeout=${TEST_TIMEOUT_MS}`],
  {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: RUN_TIMEOUT_MS,
    killSignal: "SIGKILL",
  },
);
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

/*
 * WHATEVER THE RUN LEFT BEHIND: `spawnSync`'s timeout kills the shell and nothing below it. By
 * COMMAND LINE, and on EVERY path, because a run that finished can still have leaked.
 */
const leaked = reapTestRunners();
if (leaked.length > 0) {
  console.log(`  reaped ${leaked.length} leftover runner process(es): ${leaked.join(", ")}`);
}

/*
 * TYPED READ OF THE TIMEOUT: `error` is declared as `Error` and `ETIMEDOUT` lives on `code`,
 * which only `ErrnoException` declares. The honest narrowing rather than a cast to `any`.
 */
/** @type {NodeJS.ErrnoException | undefined} */
const runError = run.error;
const timedOut = Boolean(runError && /ETIMEDOUT/i.test(String(runError.code ?? runError.message)));

ok(
  "the test run completed within its bound",
  !timedOut,
  `the suite did not finish inside ${RUN_TIMEOUT_MS / 60_000} minutes and was killed. ` +
    `A test that hangs is reported by --test-timeout and named in the summary; ` +
    `reaching THIS bound instead means the tests finished and the process would ` +
    `not exit, which is a leaked handle rather than a slow test. ` +
    `Run: node --test <file> and read process._getActiveHandles().`,
);

/** node --test prints `# tests 43` / `ℹ tests 43` depending on reporter. */
const read = (/** @type {string} */ key) => {
  const m = output.match(new RegExp(`^[#ℹ]\\s*${key}\\s+(\\d+)`, "m"));
  return m ? Number(m[1]) : null;
};

const total = read("tests");
const passed = read("pass");
const failed = read("fail");

console.log(`  node --test reported: tests ${total}, pass ${passed}, fail ${failed}`);

const slowest = slowestTests(output);
if (slowest.length > 0) {
  console.log("  slowest five:");
  for (const t of slowest) {
    console.log(`    ${(t.ms / 1000).toFixed(1).padStart(6)}s  ${t.name}`);
  }
} else {
  /* NOT SILENT: a reporter whose durations this cannot read is a reporter change. */
  console.log("  slowest five: unavailable, no durations parsed from this reporter");
}

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
const testsFloorBreach = assertFloor(
  "check:tests",
  "tests",
  total ?? 0,
  MINIMUM_TESTS,
  "Tests were removed, or a file stopped being discovered. node exits 0 on an " +
    "empty run, which is the whole reason this floor exists.",
);
ok("the executed test count has not shrunk", !testsFloorBreach, testsFloorBreach ?? "");

/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS: if those stopped, the test floor would
 * stop being consulted. MEASURED BY RUNNING IT, with slack of ZERO, justified here and almost
 * nowhere else, this gate asserting a fixed set of properties about one run.
 */
const MINIMUM_CHECKS = 5;
const floorBreach = assertFloor("check:tests", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
