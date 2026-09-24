/* This repository's half of a cap shared with the MCP wrapper's `slugSchema`, pinned at the
 * boundary in both directions. The wrapper is another repository and cannot be run here. */

import test from "node:test";
import assert from "node:assert/strict";

import { SLUG_PATTERN, frontmatterSchema } from "../app/lib/content/pipeline.mjs";

/**
 * Built rather than typed: nobody checks the length of a hand-written 121-character string.
 * @param {number} length
 */
function slugOfLength(length) {
  // "a-a-a-..." then padded with letters, so the shape rule is satisfied at
  // every length this test asks for.
  let out = "";
  while (out.length < length) out += out.length % 2 === 1 ? "-" : "a";
  const trimmed = out.slice(0, length);
  // A trailing hyphen would fail the SHAPE rule, and then a refusal would prove nothing about
  // the LENGTH rule.
  return trimmed.endsWith("-") ? `${trimmed.slice(0, -1)}a` : trimmed;
}

const rest = {
  title: "A title",
  date: "2026-09-11",
  description: "A description.",
};

test("the fixture builder produces slugs of the exact length, shape-valid", () => {
  /* A builder that returned 119 characters when asked for 121 would make every refusal below
   * prove the wrong thing. */
  for (const n of [1, 120, 121, 200]) {
    assert.equal(slugOfLength(n).length, n, `asked for ${n}`);
    assert.ok(SLUG_PATTERN.test(slugOfLength(n)), `${n} is shape-valid`);
  }
});

test("a 121-character slug is REFUSED by the frontmatter schema", () => {
  const result = frontmatterSchema.safeParse({ ...rest, slug: slugOfLength(121) });
  assert.equal(result.success, false, "121 characters must not parse");
  /* A slug that failed the shape rule instead would satisfy `success === false` while this cap
   * did nothing. */
  const issues = JSON.stringify(result.error?.issues ?? []);
  assert.match(issues, /too_big|at most 120/, `the issues were ${issues}`);
});

test("a 120-character slug is ACCEPTED, so the bound is where it says it is", () => {
  /* The other direction. A cap accidentally written as `.max(1)` refuses 121
   * perfectly well and is not the rule anybody meant. */
  const result = frontmatterSchema.safeParse({ ...rest, slug: slugOfLength(120) });
  assert.equal(result.success, true, JSON.stringify(result.error?.issues ?? []));
});

test("the shape rule still bites, so the cap did not replace it", () => {
  for (const bad of ["Not-Kebab", "trailing-", "double--hyphen", "under_score", ""]) {
    const result = frontmatterSchema.safeParse({ ...rest, slug: bad });
    assert.equal(result.success, false, `${JSON.stringify(bad)} must not parse`);
  }
});
