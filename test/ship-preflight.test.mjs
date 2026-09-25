// Orphaned `vite preview` processes from killed check:all runs hold build/client and fail ship with EBUSY.

import test from "node:test";
import assert from "node:assert/strict";

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SHIP_BUSY_NEEDLES,
  SHIP_LOCK_NEEDLE,
  busyProcesses,
  lockHolder,
  normaliseCommand,
  releaseLock,
  takeLock,
} from "../scripts/lib/child-processes.mjs";

/** @param {Array<[number, string]>} rows */
const tableOf = (rows) =>
  new Map(rows.map(([pid, command]) => [pid, { ppid: 1, command: normaliseCommand(command) }]));

test("THE PLANT: an orphaned preview server is found, and named by pid", () => {
  const found = busyProcesses(
    tableOf([
      [111, "C:/Program Files/nodejs/node.exe C:/repo/node_modules/vite/bin/vite.js preview --port 4173"],
      [222, "C:/Program Files/nodejs/node.exe C:/repo/scripts/ship.mjs"],
    ]),
    SHIP_BUSY_NEEDLES,
    222,
  );
  assert.deepEqual(found, [{ pid: 111, what: "an orphaned preview server" }]);
});

// The 2026-09-24 collision's real shape: npm, the cmd shell, the tee parent, the ship child.
/** @param {number} base */
const shipTree = (base) => [
  [base, { ppid: 1, command: normaliseCommand("node.exe C:/nodejs/node_modules/npm/bin/npm-cli.js run ship") }],
  [base + 1, { ppid: base, command: normaliseCommand("C:\\WINDOWS\\system32\\cmd.exe /d /s /c node scripts/ship.mjs") }],
  [base + 2, { ppid: base + 1, command: normaliseCommand("node  scripts/ship.mjs") }],
  [base + 3, { ppid: base + 2, command: normaliseCommand("C:\\nodejs\\node.exe C:\\repo\\scripts\\ship.mjs") }],
];

test("THE PLANT: a second ship is found, and the running ship's own launchers are not", () => {
  const table = new Map([...shipTree(100), ...shipTree(200)]);
  const found = busyProcesses(table, SHIP_BUSY_NEEDLES, 103);
  assert.deepEqual(
    found.map(({ pid }) => pid),
    [201, 202, 203],
    "the other ship's shell, tee and child; none of 100 to 103",
  );
  assert.ok(found.every(({ what }) => what === "another ship"));
});

test("a lone ship passes its own preflight", () => {
  assert.deepEqual(busyProcesses(new Map(shipTree(100)), SHIP_BUSY_NEEDLES, 103), []);
});

test("a parentage cycle from reused pids ends the ancestor walk", () => {
  const table = new Map([
    [1, { ppid: 2, command: "node scripts/ship.mjs" }],
    [2, { ppid: 1, command: "node scripts/ship.mjs" }],
  ]);
  assert.deepEqual(busyProcesses(table, SHIP_BUSY_NEEDLES, 1), []);
});

test("backslashes and case do not hide a match", () => {
  const found = busyProcesses(
    tableOf([[7, "node.exe C:\\Repo\\Scripts\\Check-All.mjs --all"]]),
    SHIP_BUSY_NEEDLES,
  );
  assert.deepEqual(found, [{ pid: 7, what: "a check:all run" }]);
});

test("ship never refuses on itself", () => {
  const table = tableOf([[42, "node C:/repo/scripts/check-all.mjs"]]);
  assert.deepEqual(busyProcesses(table, SHIP_BUSY_NEEDLES, 42), [], "self is excluded by pid");
  assert.equal(
    busyProcesses(table, SHIP_BUSY_NEEDLES, 99).length,
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
    SHIP_BUSY_NEEDLES,
  );
  assert.deepEqual(found, [], "none of these writes build/client or D1");
});

test("a process with no readable command line can never match", () => {
  const found = busyProcesses(new Map([[5, { ppid: 1, command: "" }]]), SHIP_BUSY_NEEDLES);
  assert.deepEqual(found, [], "unverifiable is left alone, never refused on");
});

test("one process matching two needles is reported once", () => {
  const found = busyProcesses(
    tableOf([[9, "node scripts/check-all.mjs && vite preview --port 4173"]]),
    SHIP_BUSY_NEEDLES,
  );
  assert.equal(found.length, 1, "a pid is a process, not a count of its needles");
});

test("an empty table finds nothing, so reporting it unread is the caller's job", () => {
  // `readProcessTable` returns an empty map when the listing itself failed.
  assert.deepEqual(busyProcesses(new Map(), SHIP_BUSY_NEEDLES), []);
});

test("THE PLANT: a second taker is refused while the holder is alive", () => {
  const dir = mkdtempSync(join(tmpdir(), "ship-lock-"));
  const lock = join(dir, "ship.lock");
  const table = new Map([[500, { ppid: 1, command: normaliseCommand("C:/nodejs/node.exe C:/repo/scripts/ship.mjs") }]]);
  try {
    assert.deepEqual(takeLock(lock, table, SHIP_LOCK_NEEDLE, 500), { ok: true, tookOver: null });
    assert.deepEqual(takeLock(lock, table, SHIP_LOCK_NEEDLE, 600), { ok: false, holder: 500 });
    assert.equal(lockHolder(lock, table, SHIP_LOCK_NEEDLE), 500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a lock left by a dead ship, or by a pid now reused, is taken over and reported", () => {
  const dir = mkdtempSync(join(tmpdir(), "ship-lock-"));
  const lock = join(dir, "ship.lock");
  try {
    writeFileSync(lock, "500");
    const reused = new Map([[500, { ppid: 1, command: "chrome.exe --type=renderer" }]]);
    assert.equal(lockHolder(lock, reused, SHIP_LOCK_NEEDLE), null, "a reused pid holds nothing");
    assert.deepEqual(takeLock(lock, reused, SHIP_LOCK_NEEDLE, 600), { ok: true, tookOver: 500 });
    assert.equal(readFileSync(lock, "utf8"), "600");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release removes only the releaser's own lock", () => {
  const dir = mkdtempSync(join(tmpdir(), "ship-lock-"));
  const lock = join(dir, "ship.lock");
  try {
    writeFileSync(lock, "500");
    releaseLock(lock, 600);
    assert.equal(existsSync(lock), true, "another ship's lock is not this one's to remove");
    releaseLock(lock, 500);
    assert.equal(existsSync(lock), false);
    releaseLock(lock, 500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
