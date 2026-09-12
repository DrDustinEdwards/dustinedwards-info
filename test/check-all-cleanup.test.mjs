/**
 * THE TIER KILLS ITS OWN CHILDREN, and this is what proves it.
 *
 * The incident, from `decisions-vol-17.md`: five `check:all` runs killed by the
 * OS for low memory between 2026-09-05 and 2026-09-09, one taking the machine
 * with it. The gates themselves do not race, which was measured rather than
 * assumed: `check-all.mjs` runs them in a plain `for` loop around a blocking
 * `spawnSync`, so `check:browser`, `check:head` and `check:worker` cannot
 * overlap and never could. What accumulates is ORPHANS BETWEEN RUNS.
 *
 * Measured 2026-09-09 during a real `check:browser`, the tree at its peak:
 *
 *     node check-browser.mjs        63 MB
 *       node npx vite preview       61 MB
 *         node (preview host)      952 MB   <- the one that matters
 *           workerd                 55 MB
 *           workerd                185 MB
 *           esbuild                  7 MB
 *       chrome (puppeteer)          99 MB + 3 children
 *
 * An OS kill under memory pressure takes the process it picked, not the tree,
 * so the 952 MB host outlives the runner and is still resident when the next
 * run starts.
 *
 * ## WHAT IS ASSERTED HERE, AND WHAT DELIBERATELY IS NOT
 *
 * Two mechanisms, and they cover different kills:
 *
 *   - a SIGNAL (Ctrl+C, SIGTERM) runs the handler, which tree-kills by pid
 *   - a HARD kill (`taskkill /F`, an OS out-of-memory kill) runs NOTHING, and
 *     the next run's preflight is what reaps it
 *
 * The second is not a weakness of the fix, it is the shape of the platform:
 * `check-browser.mjs`'s own header records the same finding, that on Windows a
 * `taskkill /F` is not deliverable as a signal, so no handler and no `finally`
 * runs. Both paths are exercised below rather than one being asserted and the
 * other assumed.
 *
 * PIDS, NEVER NAMES. The step this replays asked for "zero surviving node,
 * vitest, workerd or chrome processes", and matching those NAMES on this host
 * selects Dustin's own Chrome (18 processes, measured 2026-09-09) and his
 * editor. Every assertion here is scoped to pids this test spawned.
 *
 * @see scripts/check-all.mjs
 * @see scripts/lib/rss.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { killTree } from "../scripts/lib/child-processes.mjs";
import { lastTree, peakBetween, startRssSampler, treeSince } from "../scripts/lib/rss.mjs";

const isWindows = process.platform === "win32";

/**
 * SKIPPED OFF WINDOWS, AND VISIBLY.
 *
 * Everything below drives Windows-only machinery: the sampler is PowerShell
 * reading `Win32_Process`, and `killTree` is `taskkill /F /T`. On Linux the
 * sampler reports `available: false` by design and there is nothing to assert.
 *
 * A SKIP RATHER THAN A CONDITIONAL PASS. Wrapping the bodies in
 * `if (isWindows)` would make CI report four green tests that examined
 * nothing, which is the vacuity this repo names everywhere else. Skipped, the
 * runner prints them as skipped and the count is honest.
 *
 * The cost is stated rather than hidden: these guards do NOT run in CI, and CI
 * is Linux. They run where `check:all` runs, which is the machine the memory
 * incident happened on, and that is the only place the mechanism exists.
 */
const NOT_WINDOWS = isWindows
  ? false
  : "Windows only: the sampler reads Win32_Process and the reap is taskkill /F /T";

/** Is this pid still running? By pid, never by name. */
function alive(pid) {
  if (!isWindows) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  const out = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], { encoding: "utf8" });
  return (out.stdout ?? "").includes(String(pid));
}

/** A child that holds memory and would outlive a parent nobody cleaned up after. */
function heavyChild() {
  return spawn(
    process.execPath,
    ["-e", "const a=[];for(let i=0;i<30;i++)a.push(Buffer.alloc(5*1024*1024).fill(1));setTimeout(()=>{},120000)"],
    { stdio: "ignore" },
  );
}

/**
 * EVERY PROCESS THIS FILE STARTS, so `finally` can take all of it down.
 *
 * ## THE DEFECT THIS CLOSES, measured 2026-09-11
 *
 * Cleanup used to sit at the END of each test body. A failing assertion skips
 * it, and one of the things it skips is `sampler.stop()`. The sampler is a
 * PowerShell loop that runs until it is killed, so its ChildProcess handle
 * never closes, so this process never exits, so `node --test` never exits.
 * That is the hang: the whole-suite run sat resident on this host, and three
 * of them accumulated in one session.
 *
 * `process._getActiveHandles()` at 45 seconds named it exactly: one
 * powershell.exe running the sampler, plus two `node -e` ballast children
 * holding 150MB each on a 120-second timer. The ballast expires; the sampler
 * does not.
 *
 * ## WHY THE ASSERTION FAILED IN THE FIRST PLACE
 *
 * A fixed 2500ms wait for the sampler's first row. Run alone that bet wins and
 * every test here passes, which is why this file looked healthy for two days.
 * Run inside the whole suite, where the runner executes a file per core at
 * once, PowerShell does not start and write inside two and a half seconds,
 * `lastTree` comes back without the child, and the assertion fails.
 *
 * So the two halves compound: concurrency causes the failure, and the failure
 * leaks the process that causes the hang. Both are fixed, because fixing only
 * the leak would leave a test that reds under load for a timing reason that is
 * nobody's defect.
 *
 * A HARD EXIT REAPS THESE ANYWAY, which is why only a HANGING parent leaks:
 * node puts a non-detached child in a job object that Windows tears down with
 * the parent. Measured here, and it is why the resident process always came
 * with its whole tree attached.
 *
 * @type {Set<{ pid: number | null, stop?: () => void, kill?: (signal?: string) => unknown }>}
 */
const spawned = new Set();

/**
 * Register a child or a sampler for teardown, and hand it back so a call site
 * reads as it did before.
 *
 * @template {{ pid: number | null, stop?: () => void, kill?: (signal?: string) => unknown }} T
 * @param {T} child
 * @returns {T}
 */
function track(child) {
  spawned.add(child);
  return child;
}

/**
 * Take down everything, by TREE and by handle, and never throw.
 *
 * BOTH MECHANISMS, because they cover different things. `killTree` is
 * `taskkill /F /T` and reaches grandchildren a `kill()` on the handle would
 * miss. `kill()` closes the handle THIS process holds, which is the half that
 * lets the event loop drain. Only the first leaves the handle open until
 * Windows notices; only the second leaves grandchildren resident.
 *
 * Runs in `finally`, so it runs on the failing path, which is the only path
 * that ever mattered.
 */
function reapAll() {
  for (const child of spawned) {
    try {
      child.stop?.();
    } catch {
      // A sampler that will not stop must not mask the assertion that failed.
    }
    try {
      if (typeof child.pid === "number" && child.pid > 0) killTree(child.pid);
    } catch {
      // Same.
    }
    try {
      child.kill?.("SIGKILL");
    } catch {
      // Same.
    }
  }
  spawned.clear();
}

/**
 * How long any wait here may take before it fails BY NAME.
 *
 * Deliberately under `check:tests`' own `--test-timeout`, so a wait that never
 * satisfies produces THIS file's message naming what it was waiting for rather
 * than the runner's generic per-test timeout. A bound that fires second tells
 * you only that something was slow.
 */
const WAIT_DEADLINE_MS = 30000;

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for a CONDITION, with a deadline and a name, rather than for a duration.
 *
 * The duration form is what broke: it encodes an assumption about how busy the
 * machine is, and it is wrong exactly when the machine is busy.
 *
 * IT WAITS FOR THE INSTRUMENT, NEVER FOR THE PROPERTY. Every call below waits
 * for the sampler to have produced something, and leaves what that something
 * SAYS to the assertions. Waiting for the property itself would make the
 * assertion that follows unfailable, which is the one thing worse here than a
 * flake.
 *
 * @param {() => boolean} predicate
 * @param {string} label what is being waited for, quoted in the failure
 */
async function until(predicate, label) {
  const deadline = Date.now() + WAIT_DEADLINE_MS;
  for (;;) {
    if (predicate()) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `timed out after ${WAIT_DEADLINE_MS}ms waiting for ${label}. The sampler is ` +
          `PowerShell and is slow to start under load; this is a bound, not a verdict.`,
      );
    }
    await sleep(100);
  }
}

test("the sampler records the tree by pid, and the runner is not in it", { skip: NOT_WINDOWS }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  const sampler = track(startRssSampler(out, 250));
  const child = track(heavyChild());
  try {
    assert.equal(sampler.available, true, "the sampler started");

    /*
     * WAIT FOR THE ROW, not for 2500ms. THIS is the line that used to fail
     * under the suite's own concurrency, and its failure is what skipped the
     * teardown below and wedged the host.
     */
    await until(
      () => lastTree(out).includes(child.pid),
      `the sampler to record child ${child.pid}`,
    );

    const tree = lastTree(out);
    assert.ok(tree.includes(child.pid), "the child is in the recorded tree");
    assert.ok(
      !tree.includes(process.pid),
      "the runner is NOT in its own kill list, or the cleanup would kill the tier",
    );
  } finally {
    reapAll();
  }
});

test("THE PLANT: a killed run's children are reaped, and only those", { skip: NOT_WINDOWS }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  const sampler = track(startRssSampler(out, 250));
  const doomed = track(heavyChild());
  try {
    await until(
      () => lastTree(out).includes(doomed.pid),
      `the sampler to record child ${doomed.pid}`,
    );
    const recorded = lastTree(out);
    sampler.stop();

    assert.ok(recorded.includes(doomed.pid), "the plant landed: the child was recorded");

    /*
     * THE DISCRIMINATING CONTROL, and it is an assertion about the LIST rather
     * than a second kill.
     *
     * The first version of this test spawned a "bystander" and asserted it
     * survived. It did not, and the code was right: a child of this test process
     * IS a descendant of the sampler's root, so the sweep was correct to take it.
     * The real property worth proving is that the list is SCOPED TO THE TREE, so
     * it is checked against a live process that is nobody's descendant here.
     * Nothing unrelated is killed to prove it, which is the point.
     */
    const explorer = spawnSync("tasklist", ["/FI", "IMAGENAME eq explorer.exe", "/NH"], {
      encoding: "utf8",
    });
    const outsider = Number((explorer.stdout ?? "").trim().split(/\s+/)[1]);
    if (Number.isInteger(outsider) && outsider > 0) {
      assert.ok(
        !recorded.includes(outsider),
        "a live process outside this tree is not in the kill list",
      );
    }

    // The cleanup check-all performs, run here against the same recording.
    // `killTree` is imported at the top of this file rather than here: the
    // teardown needs it too, and a dynamic import inside the body is not
    // reachable from `finally`.
    for (const pid of recorded.filter((p) => p !== process.pid)) killTree(pid);

    // Windows releases the handle a moment after taskkill returns.
    const deadline = Date.now() + 5000;
    while (alive(doomed.pid) && Date.now() < deadline) {
      await sleep(200);
    }

    assert.equal(alive(doomed.pid), false, "the recorded child is gone within 5 seconds");
  } finally {
    reapAll();
  }
});

test("peak memory is attributed to the window that held it", { skip: NOT_WINDOWS }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  track(startRssSampler(out, 250));
  try {
    /*
     * THE WINDOWS STAY TIMED, because a window IS a duration and that is the
     * subject here. What is no longer assumed is that the sampler was running
     * during them: each window is opened only once the sampler has proven it
     * is producing rows, and is confirmed to have been sampled before anything
     * is concluded from it.
     *
     * That distinction is the whole repair. Waiting for `busy - quiet` itself
     * would make the assertion below unfailable.
     */
    await until(() => lastTree(out).length > 0, "the sampler's first row");

    const quietFrom = Date.now();
    await sleep(1400);
    const quietTo = Date.now();
    await until(
      () => peakBetween(out, quietFrom, quietTo) !== null,
      "a sample inside the quiet window",
    );

    const busyFrom = Date.now();
    track(heavyChild());
    await sleep(2200);
    const busyTo = Date.now();
    await until(
      () => peakBetween(out, busyFrom, busyTo) !== null,
      "a sample inside the busy window",
    );

    const quiet = peakBetween(out, quietFrom, quietTo);
    const busy = peakBetween(out, busyFrom, busyTo);

    assert.ok(quiet !== null && busy !== null, "both windows were sampled");
    /*
     * THE DISCRIMINATING CONTROL. An instrument that reported the same number for
     * both windows would produce a plausible per-gate table that meant nothing,
     * which is the "mark count is not a read count" shape from FAILURES.md.
     */
    assert.ok(
      busy - quiet > 100 * 1024 * 1024,
      `a window holding ~150MB more must read higher (quiet ${quiet}, busy ${busy})`,
    );

    // A window nothing sampled is null, never 0: zero is a measurement.
    assert.equal(peakBetween(out, 1, 2), null);
  } finally {
    reapAll();
  }
});

test("THE SECOND PLANT: a process that died out of the last sample is still reaped", { skip: NOT_WINDOWS }, async () => {
  /*
   * THE FLAW THE REAL INCIDENT EXPOSED, replayed.
   *
   * On 2026-09-09 a `check:all` run exhausted the machine. 14 processes holding
   * 1678 MB survived it, and the sweep, reading only the FINAL sample, named
   * two of them: the heavy ones had been spawned by `check:head` minutes
   * earlier and were not in the last row. A cleanup that reads one row is a
   * cleanup that misses whatever was not running at the instant of death.
   *
   * Here a child is recorded, then leaves the tree while sampling continues, so
   * the last row cannot name it and the union must.
   */
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  const sampler = track(startRssSampler(out, 250));
  try {
    /*
     * THE SAMPLER MUST BE PRODUCING BEFORE THE SHORT-LIVED CHILD STARTS.
     *
     * MEASURED 2026-09-11, on the first run of the three-run proof: this test
     * spawned a child that lives 1500ms and then waited for the sampler to
     * record it. PowerShell's cold start is slower than that, so the child
     * lived and died entirely inside the sampler's startup, was never sampled,
     * and the wait ran to its 30s deadline. One failure in three runs.
     *
     * The old code had the same race and merely lost it faster, by asserting
     * after a fixed 2200ms sleep instead of waiting. Ordering the startup
     * before the subject removes it rather than widening a timeout around it:
     * a deadline tuned until a race stops showing is a race nobody fixed.
     */
    await until(() => lastTree(out).length > 0, "the sampler's first row, before anything short-lived starts");

    const early = track(spawn(process.execPath, ["-e", "setTimeout(()=>{},1500)"], { stdio: "ignore" }));

    // Each step waits for the thing it needs rather than for a duration that
    // happened to be long enough on an idle machine.
    await until(() => treeSince(out, 90000).includes(early.pid), `the sampler to record ${early.pid}`);
    await until(() => !alive(early.pid), `child ${early.pid} to exit on its own`);

    // Sampling must continue PAST its death, or the last row could still name
    // it and the plant would not have landed.
    const died = Date.now();
    await until(() => peakBetween(out, died, Date.now()) !== null, "a sample taken after it died");
    sampler.stop();

    const last = lastTree(out);
    const union = treeSince(out, 90000);

    assert.ok(!last.includes(early.pid), "the plant landed: the last sample does not name it");
    assert.ok(union.includes(early.pid), "the union over the window still does");

    // The window is a bound, not decoration: an old sample must fall out of it.
    assert.ok(
      !treeSince(out, 1).includes(early.pid),
      "a one millisecond window excludes it, so the window is doing work",
    );
  } finally {
    reapAll();
  }
});
