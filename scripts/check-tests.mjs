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
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = join(root, "test");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it. Never
 * summed. The measurement is the two constants below and the dates are on
 * them; re-taking it means running the gate, not reading this sentence.
 *
 * **THE CONVENTION BELOW WAS MISSED ONCE ALREADY, on 2026-08-26.**
 * `post-image-links.test.mjs` landed without these floors moving, so for a few
 * hours the set could have lost that file and five others and still reported a
 * clean run. Caught on the next re-measurement rather than by anything, which
 * is exactly the argument for the tightness: a slack floor does not announce
 * that it has gone slack.
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
 * SHRINKING.
 *
 * **THE INVARIANT, corrected 2026-08-28, because the sentence here stated a
 * consequence that had stopped following.** It read "narrow enough that losing
 * the smallest test file still trips the file floor", which was true when the
 * ratio was written against a much smaller set and is arithmetic that does not
 * survive the set growing: at 94 percent of a measurement, ONE file out of
 * fifty-odd is well inside the margin.
 *
 * What is actually true, and what the ratio is chosen for: **each floor sits at
 * 94 percent of its own measurement, so the set has to shrink by about six
 * percent before this notices.** That is a handful of files, not one. The
 * tightness buys an early warning rather than an immediate one, and the reason
 * to keep it tight is that the margin only ever widens on its own: every test
 * added without moving these constants makes the floor slacker, silently, which
 * is exactly the drift the paragraph above records happening five times.
 *
 * Stated as the invariant rather than as a number, because a number here is a
 * third copy of the two constants below.
 */
/* 60 against 64 measured 2026-09-04 by RUNNING the gate, after
   webmention-href.test.mjs landed with roadmap item H2. It read 59 against 63
   earlier the same day, after post-readership.test.mjs landed with item G, and
   58 against 62 from 2026-09-03. Previously:
   editor-duplicate.test.mjs landed with the section F row actions. It read 56
   against 60 from 2026-08-30, and the set has grown twice since, so the margin
   had widened on its own, which is the drift the paragraph above names. */
/* RE-MEASURED 2026-09-06 by RUNNING the gate, after post-image-lqip.test.mjs
   landed with the body placeholder: 66 files. It read 61 against 65 earlier
   the same day, after math-outputs.test.mjs landed with KaTeX. Set to count
   minus check:floors' tolerance, max(3, ceil(count * 0.05)), which is 4 here.
   RE-MEASURED 2026-09-07 by RUNNING the gate, after error-rate.test.mjs landed
   with the watchdog's error-rate check: 67 files. Tolerance is 4 at this
   count, so 63. */
const MINIMUM_FILES = 63;
/* 638 against 672, RE-MEASURED 2026-09-07 by running this gate, after the six
   cases the shared upload refusal landed with. It read 632 against 666 the day
   before, which check:floors then failed at a gap of 40 against a tolerance of
   34: six cases arriving is what pushed that floor past it. The file floor
   above catches a file LEAVING; this one catches a file being hollowed out in
   place, which no file count can see. Same tolerance rule, 34 at this count.
   RE-MEASURED 2026-09-07 by RUNNING this gate, after error-rate.test.mjs
   landed with eleven cases: 683 tests. check:floors had just failed the old
   638 at a gap of 45 against a tolerance of 35, which is the mechanism working:
   eleven cases arriving is what pushed that floor past it. Tolerance is 35 at
   this count, so anything from 648 up is legal; 660 leaves the usual slack.
   RE-MEASURED 2026-09-09 by RUNNING this gate, after slug-redirect.test.mjs
   landed with ten cases: 703 tests. check:floors failed the old 660 in CI at a
   gap of 43 against a tolerance of 36, which is the same mechanism a third
   time. Tolerance is 36 at this count, so anything from 667 up is legal; 680
   leaves the usual slack.
   RE-MEASURED 2026-09-10 by RUNNING this gate, after the small-items session
   added seventeen cases across three files (startHere's two branches, ruling
   56's deferred plant, and ship's preflight scan): 720 tests. check:floors
   failed the old 680 in CI at a gap of 40 against a tolerance of 36, the same
   mechanism a FOURTH time, which is the argument for it rather than against
   it. Tolerance is 36 at this count, so anything from 684 up is legal; 700
   leaves the usual slack.
   RE-MEASURED 2026-09-12 by RUNNING this gate, after publication-entities
   .test.mjs landed with eight cases: 739 tests. check:floors failed the old 700
   in CI at a gap of 39 against a tolerance of 37, the same mechanism a FIFTH
   time, and this one is worth a line about HOW it was caught: the local run
   before the push was a set of targeted gates rather than the tier, and
   check:floors is a meta-gate that reads the tier's own output, so it was the
   one gate a targeted run could not include. CI is what saw it. Tolerance is 37
   at this count, so anything from 702 up is legal; 720 leaves the usual slack. */
const MINIMUM_TESTS = 720;

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
 * Kill any `node --test` runner this gate left behind, and report what it took.
 *
 * BY COMMAND LINE, NEVER BY IMAGE NAME. `node.exe` on this host selects this
 * gate itself, the editor's language server and the agent harness; the
 * cleanup work in `check-all.mjs` records that mistake being made and
 * corrected. The needle is the runner's own argv, which nothing else carries.
 *
 * Windows only, because that is where the leak was measured and where
 * `Get-CimInstance` exists. On other platforms it reports nothing and the gate
 * is unchanged, which is honest: the guard is not claiming coverage it has no
 * mechanism for.
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
 * The five slowest tests in the run, so a creeping hang is visible BEFORE it
 * becomes a timeout.
 *
 * The suite went from minutes to never in one commit, and nothing printed a
 * duration, so there was no gradient to notice. This prints one every run.
 *
 * READS WHATEVER REPORTER RAN. `spawnSync` is not a TTY, so node picks the tap
 * reporter and emits `duration_ms:` under each `ok`/`not ok`; a TTY run picks
 * spec and puts `(1234.5ms)` on the line itself. Both are parsed rather than
 * one being assumed, because the reporter is chosen by something this gate
 * does not control.
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
   * DEDUPED BY NAME, keeping the longest reading.
   *
   * A FAILING test appears twice in tap output, once in the stream and once in
   * the failure summary, so the first version of this list printed the same
   * 30.4s test in two of its five slots and pushed a real entry off the end.
   * Measured on the proof run that caught the ordering race, where the list
   * was the instrument being read to diagnose it.
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
ok(
  "the test file set has not shrunk",
  files.length >= MINIMUM_FILES,
  `${files.length} file(s), expected at least ${MINIMUM_FILES}. A test file was ` +
    `deleted or renamed out of the *.test.mjs pattern.`,
);

/**
 * THE RUN IS BOUNDED, TWICE, AND IT REAPS WHAT IT STARTED.
 *
 * ## The defect this closes, measured 2026-09-11
 *
 * `node --test` over the whole suite sat resident on this host and never
 * exited. `test/check-all-cleanup.test.mjs` leaked a PowerShell sampler whose
 * ChildProcess handle never closes, so the runner had nothing left to do and
 * still could not leave. This gate called `spawnSync` with NO timeout, so it
 * waited with it, forever, and took `check:head` and `check:floors` down too,
 * because both run the offline tier and the tier runs this.
 *
 * Three sessions lost a local tier to it, and three orphans accumulated in one
 * session. The leak itself is fixed in that file. This is the GUARD, and it is
 * here because the next leak will be in a different file.
 *
 * ## Two bounds, because they catch different things
 *
 * `--test-timeout` is the runner's own per-test bound: a test that hangs is
 * reported as a FAILING TEST, by name, in the summary this gate already parses.
 * That is the outcome worth having, because it names the culprit.
 *
 * `timeout` on the spawn is the backstop for everything the runner's bound
 * cannot see, which is the case that actually happened: the tests all finished
 * and the PROCESS would not exit. A per-test timeout never fires on that.
 *
 * The gate's bound is comfortably above the runner's so the runner reports
 * first when it can. `SIGKILL` rather than the default `SIGTERM`: the thing
 * being killed is a process that has already demonstrated it will not leave.
 */
const TEST_TIMEOUT_MS = 60_000;

/*
 * THE SPAWN BOUND IS LOAD-BEARING, NOT BELT AND BRACES, and the plant proved
 * it rather than the comment asserting it.
 *
 * MEASURED 2026-09-11 with an unbounded wait planted in one subtest:
 *
 *   node --test <that file alone>, --test-timeout=10000
 *     the test is CANCELLED at 10s, the other three run, and the process
 *     EXITS at 24s. Per-file, the runner's own bound is sufficient.
 *
 *   npm test (the whole suite), --test-timeout=60000
 *     903s, ending at THIS bound, with two wedged runners for the reaper to
 *     take. The per-test cancellation did not get the suite out.
 *
 * The difference is the leak. A cancelled test's `finally` never runs, because
 * the promise it is suspended on never settles, so the sampler survives and
 * that forked child cannot exit; the parent waits on its children. Alone, the
 * later tests in the same file reach their own teardown and reap the earlier
 * leak, which is why the single-file case gets out. In the suite it did not.
 *
 * So `--test-timeout` names the culprit and this bound is what ends the run.
 * Both are needed and neither is decoration.
 *
 * SIX MINUTES, against a clean run measured three times at 27, 27 and 28
 * seconds: roughly twelve times the observed cost. Low enough that a wedge
 * costs minutes instead of a quarter of an hour, high enough that a loaded
 * machine or a slower host is nowhere near it.
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
 * WHATEVER THE RUN LEFT BEHIND, taken down before this gate returns.
 *
 * `spawnSync`'s own timeout kills the shell it started and nothing below it,
 * which on Windows is the npm wrapper and not the node that holds the leak.
 * So the sweep is by COMMAND LINE against the runner's own signature, never by
 * image name: matching `node.exe` here would select this gate, the editor and
 * every other tool on the machine, which is the mistake the cleanup work in
 * `check-all.mjs` already records.
 *
 * It runs on EVERY path, not just the timeout path, because a run that
 * finished can still have leaked: that is precisely what the suite did for two
 * days while reporting failures and then hanging.
 */
const leaked = reapTestRunners();
if (leaked.length > 0) {
  console.log(`  reaped ${leaked.length} leftover runner process(es): ${leaked.join(", ")}`);
}

/*
 * TYPED READ OF THE TIMEOUT. `spawnSync`'s `error` is declared as `Error`,
 * and the `ETIMEDOUT` that a timeout sets lives on `code`, which only
 * `ErrnoException` declares. The cast is the honest narrowing rather than a
 * cast to `any`: this is exactly the shape node documents for a timed-out
 * spawn, and naming the type says so.
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
  /*
   * NOT SILENT. A reporter whose durations this cannot read is a reporter
   * change, and the whole point of the list is to make a creeping hang
   * visible, so its absence has to be visible too.
   */
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
const floorBreach = assertFloor("check:tests", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
