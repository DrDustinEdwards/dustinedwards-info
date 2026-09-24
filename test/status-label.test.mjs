/**
 * `statusLabel()` THROWS and does not substitute.
 *
 * Replays the colophon defect. `STATUS_LABEL[s] ?? s` rendered the raw enum
 * when a label was missing, which looked like working output ON THE PAGE and IN
 * THE SEARCH INDEX at the same time, so every surface agreed and every surface
 * was wrong. The no-substitution rule: a fallback that substitutes a DIFFERENT VALUE is not
 * failing closed.
 *
 * The positive cases matter as much as the throw. A "fix" that threw on
 * everything would satisfy a suite that only asserted the throw, and would take
 * the colophon down instead of mislabelling one row.
 *
 * `check:features` covers the other half, reconciling the label map against the
 * statuses `stack.json` actually uses, in both directions. That is a claim
 * about the DATA; this is a claim about the FUNCTION.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { STATUS_LABEL, statusLabel } from "../app/lib/colophon-sections.mjs";

test("every declared status maps to a non-empty label", () => {
  const keys = Object.keys(STATUS_LABEL);
  assert.ok(keys.length > 0, "STATUS_LABEL is empty, so every assertion below is vacuous");
  for (const key of keys) {
    const label = statusLabel(key);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `${key} maps to an empty label`);
    assert.notEqual(
      label,
      key,
      `${key} maps to itself, which is the substitution this function exists to prevent`,
    );
  }
});

test("an unknown status THROWS rather than returning the raw value", () => {
  assert.throws(
    () => statusLabel("not-a-real-status"),
    /not-a-real-status/,
    "it returned instead of throwing, or threw without naming the value",
  );
});

test("the throw names the value, so the failure is diagnosable", () => {
  try {
    statusLabel("wibble");
    assert.fail("did not throw");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /wibble/, "the error does not name the offending status");
    assert.match(
      message,
      /STATUS_LABEL/,
      "the error does not say where to add the missing label",
    );
  }
});
