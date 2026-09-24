/**
 * A slug is capped at the same length on both sides of the operator boundary.
 *
 * ## The split this closes
 *
 * Measured in the pre-cutover audit 2026-09-11 (P2-02b). The MCP wrapper's
 * `slugSchema` (`DrDustinEdwards/dustinedwards-mcp`, `src/tools.ts`) is
 * `z.string().min(1).max(120).regex(...)`. The site's `frontmatterSchema` was
 * `z.string().regex(SLUG_PATTERN)` with NO length bound at all.
 *
 * So the admin UI could save a post whose slug the operator tools could not
 * name. `get_post` and `save_post` would refuse it at the wrapper's schema,
 * before any request was sent, and the only surface left that could touch the
 * post would be the one that created it.
 *
 * ## What this test can and cannot see
 *
 * IT IS THIS REPOSITORY'S HALF. The wrapper is a different repository with a
 * different build, and nothing here can run its schema or read its source at
 * gate time. Pretending otherwise, by restating the wrapper's regex in this
 * file and asserting the copy, would be a test of the copy.
 *
 * What it does instead is pin THIS side exactly at the boundary, in both
 * directions, so the cap cannot be widened, narrowed or dropped without a
 * failing test naming the number. `SLUG_MAX_LENGTH`'s own docblock carries
 * why the number is 120 and who the other holder is.
 *
 * ## Why every surface, and not just the schema
 *
 * The write schema was the audit's finding, and it is the least of the three.
 * `readSlug` in the operator API interpolates a slug into a GitHub contents
 * path, and a read path that accepts what the write path refuses is the shape
 * of the 2026-08-11 finding that put `SLUG_PATTERN` on those paths in the
 * first place. A fix in one of N sites is not a fix.
 *
 * @see app/lib/content/pipeline.mjs, SLUG_MAX_LENGTH
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SLUG_PATTERN, frontmatterSchema } from "../app/lib/content/pipeline.mjs";

/**
 * A slug of exactly `length` characters that is otherwise VALID: lowercase
 * kebab-case with no double hyphen and no trailing one. Built rather than
 * typed, because a hand-written 121-character string is a thing nobody checks
 * the length of.
 *
 * @param {number} length
 */
function slugOfLength(length) {
  // "a-a-a-..." then padded with letters, so the shape rule is satisfied at
  // every length this test asks for.
  let out = "";
  while (out.length < length) out += out.length % 2 === 1 ? "-" : "a";
  const trimmed = out.slice(0, length);
  // A trailing hyphen would fail the SHAPE rule, and then a refusal would
  // prove nothing about the LENGTH rule, which is the whole subject.
  return trimmed.endsWith("-") ? `${trimmed.slice(0, -1)}a` : trimmed;
}

/** Everything a valid post needs besides the slug under test. */
const rest = {
  title: "A title",
  date: "2026-09-11",
  description: "A description.",
};

test("the fixture builder produces slugs of the exact length, shape-valid", () => {
  /* THE INSTRUMENT FIRST. A builder that returned 119 characters when asked
   * for 121 would make every refusal below prove the wrong thing. */
  for (const n of [1, 120, 121, 200]) {
    assert.equal(slugOfLength(n).length, n, `asked for ${n}`);
    assert.ok(SLUG_PATTERN.test(slugOfLength(n)), `${n} is shape-valid`);
  }
});

test("a 121-character slug is REFUSED by the frontmatter schema", () => {
  const result = frontmatterSchema.safeParse({ ...rest, slug: slugOfLength(121) });
  assert.equal(result.success, false, "121 characters must not parse");
  /* The refusal must name the LENGTH. A 121-character slug that failed the
   * shape rule instead would satisfy `success === false` while this cap did
   * nothing, which is the assertion-that-cannot-fail class. */
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
