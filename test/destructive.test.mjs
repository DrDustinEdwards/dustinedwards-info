/* The typed-count confirmation the admin pages ask for before a destructive action. */

import test from "node:test";
import assert from "node:assert/strict";

import { confirmationSatisfied } from "../app/lib/destructive.mjs";

test("the confirmation passes only on an exact match", () => {
  assert.equal(confirmationSatisfied("3", 3), true);
  assert.equal(confirmationSatisfied(" 3 ", 3), true, "surrounding space is trimmed");
});

test("the confirmation rejects everything adjacent to the count", () => {
  for (const typed of ["", "  ", "03", "3.0", "+3", "3 files", "2", "4", "three", null, undefined]) {
    assert.equal(
      confirmationSatisfied(typed, 3),
      false,
      `expected ${JSON.stringify(typed)} to be rejected for a count of 3`,
    );
  }
});

test("the confirmation refuses a count that is not a positive whole number", () => {
  // `String(typed) === String(count)` alone would accept "" against an empty trash.
  assert.equal(confirmationSatisfied("0", 0), false);
  assert.equal(confirmationSatisfied("", 0), false);
  assert.equal(confirmationSatisfied("-1", -1), false);
  assert.equal(confirmationSatisfied("1.5", 1.5), false);
});
