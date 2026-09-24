/**
 * The slug rule in its HTML shape, and the no-op that shipped before it.
 *
 * REPLAYS THE DEFECT, per the replay rule. The editor derived the input's `pattern`
 * inline, stripping the anchors with a regex whose two backslashes did not
 * survive the tool that wrote the file. The strip became a no-op and the
 * attribute shipped `^[a-z0-9]+(?:-[a-z0-9]+)*$` with its anchors intact.
 *
 * WHY NOTHING CAUGHT IT is the part worth holding on to: an HTML `pattern`
 * anchors implicitly, so the extra anchors changed no behavior at all. It
 * typechecked, every gate stayed green, and the rendered form validated exactly
 * the same strings. The only thing that was false was the comment above it.
 *
 * @see app/lib/content/pipeline.mjs
 */

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
  // The reason a trailing `$` mattered enough to strip rather than leave: with
  // it embedded, a reader has to reason about which anchor binds where. Without
  // it there is one anchoring and it is the browser's.
  const asBrowser = new RegExp(`^(?:${SLUG_ATTRIBUTE_PATTERN})$`);
  assert.equal(asBrowser.test("good-slug\nbad slug"), false);
  assert.equal(SLUG_PATTERN.test("good-slug\nbad slug"), false);
});
