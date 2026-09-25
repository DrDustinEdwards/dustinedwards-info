/* A substituting fallback renders the raw enum, which looks like working output on the page and
 * in the search index at once. The positive cases matter too: throwing on everything would take
 * the colophon down. */

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

test("an unknown status THROWS rather than returning the raw value, and names it", () => {
  assert.throws(
    () => statusLabel("wibble"),
    (error) => {
      assert.ok(error instanceof Error, "it threw a non-Error");
      assert.match(error.message, /wibble/, "the error does not name the offending status");
      assert.match(error.message, /STATUS_LABEL/, "the error does not say where to add the missing label");
      return true;
    },
  );
});
