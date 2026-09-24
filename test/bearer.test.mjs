/**
 * The two bearer primitives, tested for the properties a test can actually hold.
 *
 * WRITTEN 2026-08-28, because `app/lib/bearer.server.ts` said this file existed
 * and it did not. The docblock there claimed the extraction's equivalence was
 * "proven by differential against the pre-move bodies", named this path, and had
 * named it since 2026-08-24. The differential was real and was run; what was
 * never true is that anything committed kept it standing. A boundary note is a
 * claim that ages, and this one aged into naming an instrument nobody wrote.
 *
 * ## WHAT CANNOT BE TESTED HERE, said first so the rest is not read as more
 *
 * **CONSTANT TIME IS NOT ASSERTED.** Timing a comparison from inside the same
 * process measures the garbage collector, the JIT and whatever else the machine
 * is doing, and a flaky timing assertion in a suite that gates a deploy is worse
 * than no assertion: it teaches people to re-run until green. The property is
 * held by the SHAPE of the code, and the shape is what is asserted below.
 *
 * ## WHAT IS ASSERTED, and why the prefix case is the whole test
 *
 * The dangerous implementation is not `===`. It is a hand-rolled loop bounded by
 * one operand's length, which is the shape somebody reaches for when they hear
 * "compare without early return". That implementation answers TRUE for
 * `("abc", "abcdef")`, because it never looks past the third byte.
 *
 * Hashing both operands first is what makes that impossible: two different
 * strings have different digests whatever their lengths, and both digests are
 * the same fixed size, so the loop bound carries no information about the input.
 * So `("abc", "abcdef")` returning FALSE is simultaneously the length refusal
 * and the observable consequence of hashing both operands. One case, both
 * properties, and it fails loudly if either is undone.
 *
 * @see app/lib/bearer.server.ts
 */

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
  // Two inputs whose lengths differ by three orders of magnitude. A raw
  // comparison bounded by either one would be doing wildly different work; a
  // digest comparison does exactly the same work and answers false.
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
  // Not a reachable input on the verified path, and a label that threw would
  // turn a logging concern into a request failure.
  assert.match(tokenLabel(""), /^[0-9a-f]{8}$/);
});
