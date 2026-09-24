/**
 * The search page's sort control, which is the one ordering a reader chooses.
 *
 * WHAT MAKES THIS WORTH A TEST rather than a reading: the ordering a reader sees is not the SQL's.
 * `runIndex` orders each index's candidate fetch by bm25 and `fuse()` orders what comes back, so
 * the sort has to act on the fused list, after fusion and before pagination. Every assertion below
 * is about one of those two boundaries, because getting either wrong produces a list that looks
 * plausible on page 1 and is wrong on page 2.
 *
 * @see app/lib/search/sort.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { applySort, parseSort } from "../app/lib/search/sort.mjs";

/** Deliberately NOT in date order, so a pass cannot come from the input already being sorted. */
const HITS = [
  { uid: "a", publishAt: 1000 },
  { uid: "b", publishAt: 3000 },
  { uid: "c", publishAt: null },
  { uid: "d", publishAt: 2000 },
];

test("relevance is the default for absent, unknown and misspelled", () => {
  assert.equal(parseSort(null), "relevance");
  assert.equal(parseSort(undefined), "relevance");
  assert.equal(parseSort(""), "relevance");
  assert.equal(parseSort("newest"), "relevance");
  assert.equal(parseSort("DATE"), "relevance");
  assert.equal(parseSort("relevance"), "relevance");
});

test("only the exact string date selects date", () => {
  assert.equal(parseSort("date"), "date");
});

test("relevance returns the fused list untouched, and the SAME array", () => {
  const out = applySort(HITS, "relevance");
  assert.deepEqual(
    out.map((h) => h.uid),
    ["a", "b", "c", "d"],
  );
  // Identity, not just equality: fusion already ordered this and a copy would only add a
  // dependence on the sort being stable.
  assert.equal(out, HITS);
});

test("date orders newest first", () => {
  assert.deepEqual(
    applySort(HITS, "date").map((h) => h.uid),
    ["b", "d", "a", "c"],
  );
});

test("an undated row sorts LAST, not first", () => {
  const out = applySort(HITS, "date");
  assert.equal(out.at(-1).uid, "c", "a null publishAt must not read as epoch zero");
});

test("date does not mutate its input", () => {
  const before = HITS.map((h) => h.uid);
  applySort(HITS, "date");
  assert.deepEqual(
    HITS.map((h) => h.uid),
    before,
    "the caller still holds the fused order for the other representation",
  );
});

/*
 * THE SENTINEL, and the case that actually separates the two implementations.
 *
 * The first control written here was a null-as-zero sort, asserted to fail. IT DID NOT: 0 is below
 * every timestamp this corpus holds, so `?? 0` and `?? -Infinity` return the identical list and
 * the control agreed with everything. That is the failure the replay rule names, caught by running it.
 *
 * A PRE-EPOCH DATE is what tells them apart, and it is not hypothetical on a site that cites
 * papers: a negative `publishAt` is any date before 1970. Under `?? 0` it sorts BELOW the undated
 * row; under `-Infinity` the undated row is still last, which is what "newest" means.
 */
test("a pre-epoch date still outranks an undated row", () => {
  const withOld = [...HITS, { uid: "e", publishAt: -86400 }];
  const out = applySort(withOld, "date");
  assert.equal(out.at(-1).uid, "c", "undated is last");
  assert.equal(out.at(-2).uid, "e", "a 1969 date is dated, so it ranks above undated");
});
