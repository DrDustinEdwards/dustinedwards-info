/**
 * Ship's step 0: is anything still holding the build directory or the database?
 *
 * REPLAYS THE DEFECT, per the replay rule. On 2026-09-10 a ship failed with EBUSY
 * on build/client because `vite preview --port 4173` processes, orphaned by
 * killed `check:all` runs, still held the directory. `check:all`'s own preflight
 * reaper cannot see them: it reaps runs it RECORDED, and a run killed by the OS
 * records nothing. A live `check:all` or `check:browser` is the same hazard from
 * the other end, rewriting build/client under a ship that is reading it.
 *
 * The matcher is a pure function for the reason every other decision in
 * `scripts/lib/` is: the alternative is a branch exercised only by starting a
 * real preview server during a real ship, which is to say never.
 *
 * @see scripts/lib/child-processes.mjs
 * @see scripts/ship.mjs step 0
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  SHIP_BUSY_NEEDLES,
  busyProcesses,
  normaliseCommand,
} from "../scripts/lib/child-processes.mjs";

/**
 * SHIP'S OWN LIST, IMPORTED, NOT COPIED.
 *
 * The first version of this file wrote the three needles out again and claimed
 * `check:invariants` kept the two in step. Nothing did. A copy would go on
 * passing after somebody removed a needle from ship, so the plant would prove a
 * refusal that no longer exists, which is the mirror this repo has paid for
 * more than once.
 *
 * `ship.mjs` cannot be imported by a test, because importing it RUNS a ship, so
 * the list lives in the module both of them can reach.
 */
const SHIP_NEEDLES = SHIP_BUSY_NEEDLES;

/** @param {Array<[number, string]>} rows */
const tableOf = (rows) =>
  new Map(rows.map(([pid, command]) => [pid, { ppid: 1, command: normaliseCommand(command) }]));

test("THE PLANT: an orphaned preview server is found, and named by pid", () => {
  const found = busyProcesses(
    tableOf([
      // The command line check-browser.mjs:145 measured against the real holder.
      [111, "C:/Program Files/nodejs/node.exe C:/repo/node_modules/vite/bin/vite.js preview --port 4173"],
      [222, "C:/Program Files/nodejs/node.exe C:/repo/scripts/ship.mjs"],
    ]),
    SHIP_NEEDLES,
  );
  assert.deepEqual(found, [{ pid: 111, what: "an orphaned preview server" }]);
});

test("backslashes and case do not hide a match", () => {
  // The Windows spelling. `normaliseCommand` is what lets one needle serve both
  // platforms instead of two that agree until one is edited.
  const found = busyProcesses(
    tableOf([[7, "node.exe C:\\Repo\\Scripts\\Check-All.mjs --all"]]),
    SHIP_NEEDLES,
  );
  assert.deepEqual(found, [{ pid: 7, what: "a check:all run" }]);
});

test("ship never refuses on itself", () => {
  const table = tableOf([[42, "node C:/repo/scripts/check-all.mjs"]]);
  assert.deepEqual(busyProcesses(table, SHIP_NEEDLES, 42), [], "self is excluded by pid");
  assert.equal(
    busyProcesses(table, SHIP_NEEDLES, 99).length,
    1,
    "and only self: excluding one pid must not excuse another",
  );
});

test("an unrelated node process is not a match", () => {
  /*
   * THE DISCRIMINATING CONTROL, and it is the reason the rule is by command
   * line rather than by name. Every row here is `node` or an editor; a
   * name-based needle would refuse on all of them and ship would never run.
   */
  const found = busyProcesses(
    tableOf([
      [1, "node"],
      [2, "C:/Program Files/nodejs/node.exe server.js"],
      [3, "code.exe --type=renderer"],
      [4, "node C:/repo/scripts/check-content.mjs"],
      [5, "node C:/repo/scripts/check-microformats.mjs"],
    ]),
    SHIP_NEEDLES,
  );
  assert.deepEqual(found, [], "none of these writes build/client or D1");
});

test("a process with no readable command line can never match", () => {
  /*
   * `readProcessTable` still lists such a process, so it is visible as
   * EXISTING; it simply cannot satisfy a needle. Ship refuses on what it can
   * name and leaves what it cannot alone, which is the fail-closed direction
   * for a step that reports rather than kills.
   */
  const found = busyProcesses(new Map([[5, { ppid: 1, command: "" }]]), SHIP_NEEDLES);
  assert.deepEqual(found, [], "unverifiable is left alone, never refused on");
});

test("one process matching two needles is reported once", () => {
  const found = busyProcesses(
    tableOf([[9, "node scripts/check-all.mjs && vite preview --port 4173"]]),
    SHIP_NEEDLES,
  );
  assert.equal(found.length, 1, "a pid is a process, not a count of its needles");
});

test("an empty table finds nothing, which the caller must not read as clear", () => {
  // `readProcessTable` returns an empty map when the listing itself failed.
  // Ship prints "nothing was proven" for exactly this case rather than passing.
  assert.deepEqual(busyProcesses(new Map(), SHIP_NEEDLES), []);
});
