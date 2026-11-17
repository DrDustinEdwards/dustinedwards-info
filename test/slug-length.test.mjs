/* This repository's half of a cap shared with the MCP wrapper's `slugSchema`, pinned at the
 * boundary in both directions. The wrapper is another repository and cannot be run here. */

import test from "node:test";
import assert from "node:assert/strict";

import { frontmatterSchema } from "../app/lib/content/pipeline.mjs";

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

await test("a 121-character slug is REFUSED by the frontmatter schema", () => {
  const result = frontmatterSchema.safeParse({ ...rest, slug: slugOfLength(121) });
  assert.equal(result.success, false, "121 characters must not parse");
  /* A slug that failed the shape rule instead would satisfy `success === false` while this cap
   * did nothing. */
  const issues = JSON.stringify(result.error?.issues ?? []);
  assert.match(issues, /too_big|at most 120/, `the issues were ${issues}`);
});

await test("a 120-character slug is ACCEPTED, so the bound is where it says it is", () => {
  /* The other direction. A cap accidentally written as `.max(1)` refuses 121
   * perfectly well and is not the rule anybody meant. */
  const result = frontmatterSchema.safeParse({ ...rest, slug: slugOfLength(120) });
  assert.equal(result.success, true, JSON.stringify(result.error?.issues ?? []));
});
