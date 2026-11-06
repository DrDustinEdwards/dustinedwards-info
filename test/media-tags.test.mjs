import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  normalizeTag,
  normalizeTags,
  parseTags,
  serializeTags,
} from "../app/lib/media/tags.mjs";

await test("the stored order is SORTED, so typing order cannot change the bytes", () => {
  assert.equal(serializeTags(["zeta", "alpha"]), serializeTags(["alpha", "zeta"]));
});

await test("normalization: case, whitespace, and the delimiter itself", () => {
  assert.equal(normalizeTag("  Cloudflare  "), "cloudflare");
  assert.equal(normalizeTag("Two Words"), "two-words");
  assert.equal(normalizeTag("a,b"), "a-b", "a comma inside a part cannot survive");
  assert.equal(normalizeTag("--edges--"), "edges");
  assert.equal(normalizeTag("a---b"), "a-b");
});

await test("LIKE WILDCARDS CANNOT BE STORED, so a value never becomes a pattern", () => {
  // A tag of `%` stored raw would make `LIKE '%,%,%'` match every tagged row.
  assert.equal(normalizeTag("%"), "");
  assert.equal(normalizeTag("_"), "");
  assert.equal(normalizeTag("a%b"), "ab");
  assert.equal(normalizeTag("a_b"), "ab");
  assert.ok(!serializeTags(["%", "_"]).includes("%"));
});

await test("duplicates collapse, however they were spelled", () => {
  assert.deepEqual(normalizeTags(["Art", "art", " ART "]), ["art"]);
});

await test("the list is capped and each tag is capped", () => {
  const many = Array.from({ length: MAX_TAGS + 8 }, (_, i) => `tag${i}`);
  assert.equal(normalizeTags(many).length, MAX_TAGS);
  const long = "x".repeat(MAX_TAG_LENGTH + 40);
  assert.ok(normalizeTag(long).length <= MAX_TAG_LENGTH);
});

await test("a delimited string and an array normalize identically", () => {
  assert.deepEqual(normalizeTags("alpha,beta"), normalizeTags(["alpha", "beta"]));
});

await test("round trip: serialize then parse returns the same list", () => {
  const tags = ["alpha", "beta", "gamma"];
  assert.deepEqual(parseTags(serializeTags(tags)), tags);
});

await test("FAILS CLOSED: garbage parses to an empty list rather than throwing", () => {
  assert.deepEqual(parseTags(null), []);
  assert.deepEqual(parseTags(undefined), []);
  assert.deepEqual(parseTags(42), []);
  assert.deepEqual(parseTags(""), []);
  assert.deepEqual(normalizeTags(null), []);
  assert.deepEqual(normalizeTags(99), []);
});
