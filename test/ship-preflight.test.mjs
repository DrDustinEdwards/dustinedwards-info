// Orphaned `vite preview` processes from killed check:all runs hold build/client and fail ship with EBUSY.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SHIP_BUSY_NEEDLES,
  busyProcesses,
  normaliseCommand,
} from "../scripts/lib/child-processes.mjs";

// `ship.mjs` cannot be imported by a test (importing it RUNS a ship), so the list lives in a shared module.
const SHIP_NEEDLES = SHIP_BUSY_NEEDLES;

/** @param {Array<[number, string]>} rows */
const tableOf = (rows) =>
  new Map(rows.map(([pid, command]) => [pid, { ppid: 1, command: normaliseCommand(command) }]));

test("THE PLANT: an orphaned preview server is found, and named by pid", () => {
  const found = busyProcesses(
    tableOf([
      [111, "C:/Program Files/nodejs/node.exe C:/repo/node_modules/vite/bin/vite.js preview --port 4173"],
      [222, "C:/Program Files/nodejs/node.exe C:/repo/scripts/ship.mjs"],
    ]),
    SHIP_NEEDLES,
  );
  assert.deepEqual(found, [{ pid: 111, what: "an orphaned preview server" }]);
});

test("backslashes and case do not hide a match", () => {
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
  // By command line, not by name: a name-based needle would refuse on every node process.
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
  assert.deepEqual(busyProcesses(new Map(), SHIP_NEEDLES), []);
});
