import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  exactTagNeedle,
  normaliseTag,
  normaliseTags,
  parseTags,
  serialiseTags,
} from "../app/lib/media/tags.mjs";

const db = new DatabaseSync(":memory:");
const likeQuery = db.prepare("SELECT lower(?) LIKE ? AS hit");

/** SQLite's own LIKE, spelled as `listMediaPage` spells it, rather than a model of it. */
const like = (/** @type {string} */ value, /** @type {string} */ pattern) =>
  likeQuery.get(value, pattern)?.hit === 1;

test("THE DECISIVE CASE: an exact tag filter separates art from chart", () => {
  const artRow = serialiseTags(["art"]);
  const chartRow = serialiseTags(["chart"]);
  const needle = exactTagNeedle("art");

  assert.equal(artRow, ",art,");
  assert.equal(chartRow, ",chart,");
  assert.equal(needle, "%,art,%");

  assert.ok(like(artRow, needle), "the art row must match");
  assert.ok(!like(chartRow, needle), "the chart row must NOT match");
});

test("free text still matches both, which is correct for a search box", () => {
  assert.ok(like(serialiseTags(["art"]), "%art%"));
  assert.ok(like(serialiseTags(["chart"]), "%art%"));
});

test("an untagged row cannot match any tag needle", () => {
  // Stored as "" rather than "," precisely so `%,%` finds nothing here.
  const empty = serialiseTags([]);
  assert.equal(empty, "");
  assert.ok(!like(empty, "%,%"));
  assert.ok(!like(empty, exactTagNeedle("art") ?? "%"));
});

test("a tag in the middle of a list matches, so the wrap is not just cosmetic", () => {
  const row = serialiseTags(["alpha", "art", "zeta"]);
  assert.equal(row, ",alpha,art,zeta,");
  assert.ok(like(row, exactTagNeedle("art") ?? "%"));
  assert.ok(like(row, exactTagNeedle("alpha") ?? "%"), "first element");
  assert.ok(like(row, exactTagNeedle("zeta") ?? "%"), "last element");
});

test("the stored order is SORTED, so typing order cannot change the bytes", () => {
  assert.equal(serialiseTags(["zeta", "alpha"]), serialiseTags(["alpha", "zeta"]));
});

test("normalization: case, whitespace, and the delimiter itself", () => {
  assert.equal(normaliseTag("  Cloudflare  "), "cloudflare");
  assert.equal(normaliseTag("Two Words"), "two-words");
  assert.equal(normaliseTag("a,b"), "a-b", "a comma inside a part cannot survive");
  assert.equal(normaliseTag("--edges--"), "edges");
  assert.equal(normaliseTag("a---b"), "a-b");
});

test("LIKE WILDCARDS CANNOT BE STORED, so a value never becomes a pattern", () => {
  // A tag of `%` stored raw would make `LIKE '%,%,%'` match every tagged row.
  assert.equal(normaliseTag("%"), "");
  assert.equal(normaliseTag("_"), "");
  assert.equal(normaliseTag("a%b"), "ab");
  assert.equal(normaliseTag("a_b"), "ab");
  assert.ok(!serialiseTags(["%", "_"]).includes("%"));
});

test("duplicates collapse, however they were spelled", () => {
  assert.deepEqual(normaliseTags(["Art", "art", " ART "]), ["art"]);
});

test("the list is capped and each tag is capped", () => {
  const many = Array.from({ length: MAX_TAGS + 8 }, (_, i) => `tag${i}`);
  assert.equal(normaliseTags(many).length, MAX_TAGS);
  const long = "x".repeat(MAX_TAG_LENGTH + 40);
  assert.ok(normaliseTag(long).length <= MAX_TAG_LENGTH);
});

test("a delimited string and an array normalize identically", () => {
  assert.deepEqual(normaliseTags("alpha,beta"), normaliseTags(["alpha", "beta"]));
});

test("round trip: serialize then parse returns the same list", () => {
  const tags = ["alpha", "beta", "gamma"];
  assert.deepEqual(parseTags(serialiseTags(tags)), tags);
});

test("FAILS CLOSED: garbage parses to an empty list rather than throwing", () => {
  assert.deepEqual(parseTags(null), []);
  assert.deepEqual(parseTags(undefined), []);
  assert.deepEqual(parseTags(42), []);
  assert.deepEqual(parseTags(""), []);
  assert.deepEqual(normaliseTags(null), []);
  assert.deepEqual(normaliseTags(99), []);
});

test("an empty needle is NULL, never a pattern that matches everything", () => {
  // `%,,%` would match every tagged row.
  assert.equal(exactTagNeedle(""), null);
  assert.equal(exactTagNeedle("   "), null);
  assert.equal(exactTagNeedle("%"), null);
  assert.equal(exactTagNeedle(null), null);
});
