import test from "node:test";
import assert from "node:assert/strict";

import { blockFrom, functionBody } from "../scripts/lib/source-body.mjs";

test("a block ends at its own closing brace, not a fixed window later", () => {
  const src = [
    "function a(x) {",
    "  if (x) { return { status: 200 }; }",
    "}",
    "function b() { return new Response(null, { status: 405 }); }",
  ].join("\n");
  const body = functionBody(src, /function a\b/);
  assert.equal(body.startsWith("{"), true);
  assert.equal(body.endsWith("}"), true);
  assert.equal(body.includes("405"), false, "the next function is not part of this one");
  assert.equal(functionBody(src, /function b\b/).includes("405"), true);
});

test("a brace inside a string does not close the block", () => {
  const src = 'const f = () => { const s = "}"; const t = `${"{"}`; return "done"; }; after();';
  const body = blockFrom(src, 0);
  assert.equal(body.includes("done"), true);
  assert.equal(body.includes("after"), false);
});

test("no block, or an unclosed one, is empty rather than the rest of the file", () => {
  assert.equal(blockFrom("no braces here", 0), "");
  assert.equal(blockFrom("function x() { never closed", 0), "");
  assert.equal(functionBody("const y = 1;", /function x\b/), "");
});
