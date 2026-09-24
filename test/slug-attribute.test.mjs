/* An HTML `pattern` anchors implicitly, so leftover anchors change no behavior and no gate
 * catches them. */

import test from "node:test";
import assert from "node:assert/strict";

import { SLUG_ATTRIBUTE_PATTERN, SLUG_PATTERN } from "../app/lib/content/pipeline.mjs";

test("re-anchored, it accepts and rejects exactly what SLUG_PATTERN does", () => {
  // What the browser does with the attribute: compile it as ^(?:...)$.
  const asBrowser = new RegExp(`^(?:${SLUG_ATTRIBUTE_PATTERN})$`);
  const cases = [
    "a-good-slug", "post2", "2026-in-review", "a",
    "Capital", "trailing-", "-leading", "double--dash", "has space",
    "has/slash", "..", "with.dot", "", "a-b-c-d-e-f",
  ];
  for (const value of cases) {
    assert.equal(
      asBrowser.test(value),
      SLUG_PATTERN.test(value),
      `"${value}" must be judged the same by both`,
    );
  }
});

test("a multiline value cannot slip past the attribute's anchoring", () => {
  // With `$` embedded a reader has to reason about which anchor binds where.
  const asBrowser = new RegExp(`^(?:${SLUG_ATTRIBUTE_PATTERN})$`);
  assert.equal(asBrowser.test("good-slug\nbad slug"), false);
  assert.equal(SLUG_PATTERN.test("good-slug\nbad slug"), false);
});
