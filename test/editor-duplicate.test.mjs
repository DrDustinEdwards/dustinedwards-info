/**
 * `copySlugCandidates()`: what a duplicated post is called.
 *
 * Section F item 3 asks for a `-copy` slug. The interesting half is not the
 * first candidate, it is what happens on the second press and on a copy of a
 * copy, because a naive suffix compounds: `a-post-copy-copy-copy` is a URL
 * nobody would choose and the author would have to fix it by hand every time.
 *
 * The pattern assertion here is deliberately made against the EXPORTED
 * `SLUG_PATTERN` rather than against a spelling of it: hard rule 6 makes that
 * constant the owner of what a slug may be, and a test carrying its own regex
 * would be the second copy that rule exists to prevent.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { copySlugCandidates } from "../app/lib/editor/duplicate.mjs";
import { SLUG_PATTERN } from "../app/lib/content/pipeline.mjs";

test("the first candidate is the plain -copy form", () => {
  assert.equal(copySlugCandidates("a-post")[0], "a-post-copy");
});

test("later candidates are numbered from 2, never from 1", () => {
  // `-copy-1` would be a second name for the position `-copy` already holds.
  assert.deepEqual(copySlugCandidates("a-post", 4), [
    "a-post-copy",
    "a-post-copy-2",
    "a-post-copy-3",
    "a-post-copy-4",
  ]);
});

test("THE COMPOUNDING DEFECT: a copy of a copy stays flat", () => {
  // Duplicating `a-post-copy` offers the SAME family as duplicating `a-post`.
  // The first candidate is the original copy's own slug, which the caller finds
  // occupied and steps past, so the result is `a-post-copy-2` rather than a
  // second suffix. The freeness check belongs to the caller; what is asserted
  // here is that the family the caller walks never compounds.
  assert.deepEqual(copySlugCandidates("a-post-copy", 3), copySlugCandidates("a-post", 3));
  assert.deepEqual(copySlugCandidates("a-post-copy-7", 3), copySlugCandidates("a-post", 3));
  // The family never grows a second suffix, however many times it is pressed.
  for (const slug of ["a-post", "a-post-copy", "a-post-copy-7"]) {
    for (const candidate of copySlugCandidates(slug)) {
      assert.ok(
        !candidate.includes("copy-copy"),
        `${slug} produced a compounded suffix: ${candidate}`,
      );
    }
  }
});

test("every candidate is a slug the URL rules accept", () => {
  for (const slug of ["a-post", "x", "a-post-copy", "copy", "how-to-copy"]) {
    for (const candidate of copySlugCandidates(slug, 5)) {
      assert.match(candidate, SLUG_PATTERN, `${slug} produced an invalid slug: ${candidate}`);
    }
  }
});

test("a slug that is nothing but the suffix keeps its own name as the base", () => {
  // Stripping would leave the empty string, and `-copy` is not a slug.
  assert.equal(copySlugCandidates("copy")[0], "copy-copy");
});

test("the limit is honored, so the caller's probe loop is bounded", () => {
  assert.equal(copySlugCandidates("a-post", 1).length, 1);
  assert.equal(copySlugCandidates("a-post", 9).length, 9);
});
