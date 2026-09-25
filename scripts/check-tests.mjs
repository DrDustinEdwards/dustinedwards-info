import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { descendantPids, killTree, processExists, readProcessTable } from "./lib/child-processes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test");

// Measured by running the gate, never summed, and tight: they move up with a test in the same commit,
// so the set shrinking is noticed.
const MINIMUM_FILES = 93;
// Catches a test file hollowed out in place. Measured by running the gate.
const MINIMUM_TESTS = 780;

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
 * By parentage from this gate's own spawn, never by a machine-wide command-line match: another
 * worktree's `node --test "test/**"` has the same command line and is not this gate's to kill.
 * The spawned shell is dead after a timeout, so its descendants are walked from its pid.
 *
 * @param {number | undefined} rootPid the pid spawnSync reported for the test run's shell
 * @returns {{ killed: number[], failed: number[], unreadable: boolean }}
 */
function reapTestRunners(rootPid) {
  if (!Number.isInteger(rootPid) || Number(rootPid) <= 0) return { killed: [], failed: [], unreadable: false };
  const table = readProcessTable();
  if (table.size === 0) return { killed: [], failed: [], unreadable: true };
  /** @type {number[]} */
  const killed = [];
  /** @type {number[]} */
  const failed = [];
  // The shell is dead, so its direct child must be the npm run it spawned, named by the bound passed to it.
  for (const pid of descendantPids(Number(rootPid), table, `--test-timeout=${TEST_TIMEOUT_MS}`)) {
    if (!processExists(pid)) continue;
    (killTree(pid) ? killed : failed).push(pid);
  }
  return { killed, failed, unreadable: false };
}

/**
 * The five slowest tests, so a creeping hang is visible before it is a timeout. Both reporters are
 * parsed, the choice not being this gate's.
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

  // Deduped by name, longest kept: a failing test appears twice in tap output.
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
const filesBreach = assertFloor(
  "check:tests",
  "files",
  files.length,
  MINIMUM_FILES,
  "A test file was deleted or renamed out of the *.test.mjs pattern.",
);
ok("the test file set has not shrunk", filesBreach === null, filesBreach ?? "");

/**
 * Bounded twice: `--test-timeout` names a hung test, and the spawn timeout is the backstop, because a
 * canceled test's `finally` never runs and its child survives. `SIGKILL`, because it will not leave.
 */
const TEST_TIMEOUT_MS = 60_000;

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

// `spawnSync`'s timeout kills the shell and nothing below it, so reap its descendants on every path.
const leaked = reapTestRunners(run.pid);
if (leaked.killed.length > 0) {
  console.log(`  reaped ${leaked.killed.length} leftover runner process(es): ${leaked.killed.join(", ")}`);
}
if (leaked.failed.length > 0) {
  console.log(`  could NOT kill ${leaked.failed.length} leftover runner process(es): ${leaked.failed.join(", ")}`);
}
if (leaked.unreadable) {
  console.log("  could not read the process table, so leftover runner processes were not looked for");
}

// `ETIMEDOUT` lives on `code`, which only `ErrnoException` declares.
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

const MINIMUM_CHECKS = 5;
const floorBreach = assertFloor("check:tests", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
