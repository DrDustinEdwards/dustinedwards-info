// The registry is how a killed gate's children are found by the next run, so a bad line must not lose the rest.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ChildRegistry, recordedTreeLeftovers } from "../scripts/lib/child-processes.mjs";

/** @param {string} content */
function registryWith(content) {
  const dir = mkdtempSync(join(tmpdir(), "child-registry-"));
  const file = join(dir, "registry.jsonl");
  writeFileSync(file, content);
  return { registry: new ChildRegistry(file), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("THE PLANT: one torn line does not empty the registry", () => {
  const { registry, cleanup } = registryWith(
    `${JSON.stringify({ pid: 101, kind: "vite preview", needles: ["preview --port 4173"] })}\n` +
      `{"pid": 102, "kind": "chro\n` +
      `${JSON.stringify({ pid: 103, kind: "chrome", needles: ["--remote-debugging-port"] })}\n`,
  );
  try {
    const { entries, torn } = registry.readAll();
    assert.deepEqual(
      entries.map((e) => e.pid),
      [101, 103],
      "the lines either side of the torn one survive",
    );
    assert.equal(torn, 1, "and the torn line is counted, not silently dropped");
    assert.deepEqual(registry.read().map((e) => e.pid), [101, 103]);
  } finally {
    cleanup();
  }
});

test("a parseable line with no needles is counted as unreadable, never killed on its pid", () => {
  const { registry, cleanup } = registryWith(`${JSON.stringify({ pid: 7, kind: "x", needles: [] })}\n`);
  try {
    assert.deepEqual(registry.readAll(), { entries: [], torn: 1 });
  } finally {
    cleanup();
  }
});

test("a missing registry is empty, not an error", () => {
  const registry = new ChildRegistry(join(tmpdir(), "child-registry-absent", "none.jsonl"));
  assert.deepEqual(registry.readAll(), { entries: [], torn: 0 });
});

test("THE PLANT: a recorded pid now owned by something else is not a leftover", () => {
  // Pid 30 was a gate's child; Windows handed it to a browser tab whose parent is the browser.
  const table = new Map([
    [10, { ppid: 5, command: "cmd.exe /c npm run check:tests" }],
    [11, { ppid: 10, command: "node --test" }],
    [30, { ppid: 900, command: "chrome.exe --type=renderer" }],
  ]);
  assert.deepEqual(recordedTreeLeftovers([10, 11, 30], table, 5), [10, 11]);
});

test("a dead runner's orphans are still found through the runner's recorded pid", () => {
  const table = new Map([[10, { ppid: 5, command: "cmd.exe" }]]);
  assert.deepEqual(recordedTreeLeftovers([10], table, 5), [10]);
  assert.deepEqual(recordedTreeLeftovers([10], table, null), [], "without the runner, its direct child is unproven");
});

test("the runner itself and dead pids are never leftovers", () => {
  const table = new Map([[5, { ppid: 1, command: "node scripts/check-all.mjs" }]]);
  assert.deepEqual(recordedTreeLeftovers([5, 6], table, 5), []);
});
