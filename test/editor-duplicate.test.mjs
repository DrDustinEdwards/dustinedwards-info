/* A naive suffix compounds into `a-post-copy-copy-copy`. Slugs are checked against the EXPORTED
 * `SLUG_PATTERN`, never a local spelling of it. */

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
  // The first candidate is the copy's own slug, which the caller finds occupied and steps past;
  // freeness is the caller's job, and what is asserted is that the family never compounds.
  assert.deepEqual(copySlugCandidates("a-post-copy", 3), copySlugCandidates("a-post", 3));
  assert.deepEqual(copySlugCandidates("a-post-copy-7", 3), copySlugCandidates("a-post", 3));
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
