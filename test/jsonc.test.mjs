import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseJsonc } from "../scripts/lib/wrangler-surface.mjs";

/** @param {string} text */
function parse(text) {
  const dir = mkdtempSync(join(tmpdir(), "jsonc-"));
  try {
    const file = join(dir, "c.jsonc");
    writeFileSync(file, text);
    return parseJsonc(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a /* inside a line comment does not swallow the keys up to a later */", () => {
  const config = parse(
    [
      "{",
      "  // sign-in and /api/auth/*",
      '  "kept": 1,',
      "  /* a real block */",
      '  "also": 2',
      "}",
    ].join("\n"),
  );
  assert.deepEqual(config, { kept: 1, also: 2 });
});

test("a /* inside a string is a string, and a trailing comma is accepted", () => {
  const config = parse('{ "pattern": "example.com/*", "n": 1, }');
  assert.deepEqual(config, { pattern: "example.com/*", n: 1 });
});

test("invalid JSONC throws with the path", () => {
  assert.throws(() => parse('{ "a": }'), /is not valid JSONC/);
});
