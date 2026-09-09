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

test("the sampler records the tree by pid, and the runner is not in it", { skip: NOT_WINDOWS }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  const sampler = startRssSampler(out, 250);
  assert.equal(sampler.available, true, "the sampler started");

  const child = heavyChild();
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const tree = lastTree(out);
  assert.ok(tree.includes(child.pid), "the child is in the recorded tree");
  assert.ok(
    !tree.includes(process.pid),
    "the runner is NOT in its own kill list, or the cleanup would kill the tier",
  );

  sampler.stop();
  child.kill();
});

test("THE PLANT: a killed run's children are reaped, and only those", { skip: NOT_WINDOWS }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  const sampler = startRssSampler(out, 250);

  const doomed = heavyChild();
  await new Promise((resolve) => setTimeout(resolve, 2500));
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
  const { killTree } = await import("../scripts/lib/child-processes.mjs");
  for (const pid of recorded.filter((p) => p !== process.pid)) killTree(pid);

  // Windows releases the handle a moment after taskkill returns.
  const deadline = Date.now() + 5000;
  while (alive(doomed.pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  assert.equal(alive(doomed.pid), false, "the recorded child is gone within 5 seconds");
});

test("peak memory is attributed to the window that held it", { skip: NOT_WINDOWS }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "rss-")), "samples.csv");
  writeFileSync(out, "");
  const sampler = startRssSampler(out, 250);

  await new Promise((resolve) => setTimeout(resolve, 1200));
  const quietFrom = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const quietTo = Date.now();

  const busyFrom = Date.now();
  const child = heavyChild();
  await new Promise((resolve) => setTimeout(resolve, 2200));
  const busyTo = Date.now();
  child.kill();
  sampler.stop();

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
  const sampler = startRssSampler(out, 250);

  const early = spawn(process.execPath, ["-e", "setTimeout(()=>{},1500)"], { stdio: "ignore" });
  await new Promise((resolve) => setTimeout(resolve, 2200));

  // It has exited, so later samples cannot mention it.
  await new Promise((resolve) => setTimeout(resolve, 2000));
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
});
