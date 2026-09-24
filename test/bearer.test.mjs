// Constant time is not asserted: timing inside one process measures the GC and JIT, and a
// flaky timing assertion in a deploy gate teaches people to re-run until green.

import test from "node:test";
import assert from "node:assert/strict";

import { constantTimeEqual, tokenLabel } from "../app/lib/bearer.server.ts";

test("equal strings compare equal", async () => {
  assert.equal(await constantTimeEqual("", ""), true);
  assert.equal(await constantTimeEqual("s3cret", "s3cret"), true);
  assert.equal(
    await constantTimeEqual("a".repeat(4096), "a".repeat(4096)),
    true,
    "length alone must not change the verdict",
  );
});

test("different strings of the same length compare unequal", async () => {
  assert.equal(await constantTimeEqual("s3cret", "s3crev"), false);
  assert.equal(await constantTimeEqual("abc", "cba"), false);
});

test("a PREFIX is refused, which is the length refusal and the hash shape at once", async () => {
  assert.equal(
    await constantTimeEqual("abc", "abcdef"),
    false,
    "a prefix compared equal, which is what a loop bounded by one operand does",
  );
  assert.equal(
    await constantTimeEqual("abcdef", "abc"),
    false,
    "the same failure with the operands swapped",
  );
  assert.equal(
    await constantTimeEqual("", "x"),
    false,
    "the empty string is a prefix of everything, so it is the extreme case",
  );
});

test("both operands are hashed, so neither length reaches the loop bound", async () => {
  assert.equal(await constantTimeEqual("x", "x".repeat(100_000)), false);
  assert.equal(await constantTimeEqual("x".repeat(100_000), "x"), false);
});

test("tokenLabel is stable, fixed width, and moves when the token does", () => {
  const label = tokenLabel("operator-token-value");
  assert.equal(label, tokenLabel("operator-token-value"), "not stable across calls");
  assert.match(label, /^[0-9a-f]{8}$/, "not eight lowercase hex characters");
  assert.notEqual(
    label,
    tokenLabel("operator-token-value-rotated"),
    "a rotated token produced the same label, so the label cannot identify a holder",
  );
  assert.notEqual(label, "operator-token-value", "the label is the token");
});

test("tokenLabel labels the empty string without throwing", () => {
  assert.match(tokenLabel(""), /^[0-9a-f]{8}$/);
});
