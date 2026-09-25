// The registry is how a killed gate's children are found by the next run, so a bad line must not lose the rest.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ChildRegistry } from "../scripts/lib/child-processes.mjs";

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
