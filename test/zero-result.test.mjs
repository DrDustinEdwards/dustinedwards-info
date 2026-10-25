/**
 * The schema has nowhere to put an IP or session, so the query text is the only way a personal
 * fact reaches the table. One shape per test: a loop that stopped iterating would report a clean sweep.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ZERO_RESULT_MAX_LENGTH,
  normalizeZeroResultQuery as normalize,
} from "../app/lib/search/zero-result.mjs";

await test("an ordinary query is kept, lowercased and collapsed", () => {
  assert.equal(normalize("D1  Backups"), "d1 backups");
  assert.equal(normalize("  cloudflare  "), "cloudflare");
});

await test("a query too short to be a question is refused", () => {
  assert.equal(normalize("d1"), null);
  assert.equal(normalize(""), null);
  assert.equal(normalize("   "), null);
});

await test("an over-long query is REFUSED, not truncated", () => {
  const long = "a".repeat(ZERO_RESULT_MAX_LENGTH + 1);
  assert.equal(
    normalize(long),
    null,
    "truncating would store the first 200 characters of whatever was pasted",
  );
  assert.equal(normalize("a".repeat(ZERO_RESULT_MAX_LENGTH)), "a".repeat(ZERO_RESULT_MAX_LENGTH));
});

await test("an email address is refused", () => {
  assert.equal(normalize("email@dustinedwards.info"), null);
  assert.equal(normalize("is jane.doe@example.org here"), null);
});

await test("a phone-shaped run of digits is refused", () => {
  assert.equal(normalize("call 555 123 4567"), null);
  assert.equal(normalize("+44 20 7946 0958"), null);
});

await test("two capitalized words in a row is refused as a name shape", () => {
  assert.equal(normalize("Dustin Edwards"), null);
  assert.equal(normalize("papers by Jane Smith"), null);
});

await test("the name shape over-matches, and that is the accepted cost", () => {
  assert.equal(
    normalize("Cloudflare Workers"),
    null,
    "a lost row in a demand list is cheaper than a name list living in the repo",
  );
  assert.equal(normalize("cloudflare workers"), "cloudflare workers", "the lower-case form is kept");
});

await test("a sentence-case query is NOT caught by the name shape", () => {
  assert.equal(normalize("How do backups work"), "how do backups work");
});

await test("punctuation with no letters or digits is refused", () => {
  assert.equal(normalize("???"), null);
  assert.equal(normalize("--- ---"), null);
});

await test("a non-string is refused rather than coerced", () => {
  assert.equal(normalize(undefined), null);
  assert.equal(normalize(null), null);
  assert.equal(normalize(42), null);
});

await test("the refusals discriminate: ordinary queries still get through", () => {
  const kept = ["d1 backups", "how do backups work", "phage cocktail", "workers cache"].map(normalize);
  assert.ok(
    kept.every((q) => typeof q === "string" && q.length > 0),
    "a normalizer that refused everything would satisfy every refusal test above",
  );
});

await test("the case tests run BEFORE lowercasing, or the name shape sees nothing", () => {
  assert.equal(normalize("Jane Smith"), null);
  assert.equal(normalize("jane smith"), "jane smith");
});
