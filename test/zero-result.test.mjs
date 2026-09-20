/**
 * The zero-result query normaliser, which is the privacy boundary of the whole feature.
 *
 * EVERYTHING THE TABLE WILL EVER CONTAIN PASSES THROUGH THIS FUNCTION. The schema has nowhere to
 * put an IP, a user agent or a session, so the only way a personal fact reaches the database is
 * inside the query text itself. That makes these refusals the assertion worth having, and it is
 * why they are tested one shape at a time rather than in a loop: a loop that stopped iterating
 * would report a clean sweep.
 *
 * @see app/lib/search/zero-result.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ZERO_RESULT_MAX_LENGTH,
  normaliseZeroResultQuery as normalise,
} from "../app/lib/search/zero-result.mjs";

test("an ordinary query is kept, lowercased and collapsed", () => {
  assert.equal(normalise("D1  Backups"), "d1 backups");
  assert.equal(normalise("  cloudflare  "), "cloudflare");
});

test("a query too short to be a question is refused", () => {
  assert.equal(normalise("d1"), null);
  assert.equal(normalise(""), null);
  assert.equal(normalise("   "), null);
});

test("an over-long query is REFUSED, not truncated", () => {
  const long = "a".repeat(ZERO_RESULT_MAX_LENGTH + 1);
  assert.equal(
    normalise(long),
    null,
    "truncating would store the first 200 characters of whatever was pasted",
  );
  assert.equal(normalise("a".repeat(ZERO_RESULT_MAX_LENGTH)), "a".repeat(ZERO_RESULT_MAX_LENGTH));
});

test("an email address is refused", () => {
  assert.equal(normalise("email@dustinedwards.info"), null);
  assert.equal(normalise("is jane.doe@example.org here"), null);
});

test("a phone-shaped run of digits is refused", () => {
  assert.equal(normalise("call 555 123 4567"), null);
  assert.equal(normalise("+44 20 7946 0958"), null);
});

test("two capitalised words in a row is refused as a name shape", () => {
  assert.equal(normalise("Dustin Edwards"), null);
  assert.equal(normalise("papers by Jane Smith"), null);
});

test("the name shape over-matches, and that is the accepted cost", () => {
  assert.equal(
    normalise("Cloudflare Workers"),
    null,
    "a lost row in a demand list is cheaper than a name list living in the repo",
  );
  assert.equal(normalise("cloudflare workers"), "cloudflare workers", "the lower-case form is kept");
});

test("a sentence-case query is NOT caught by the name shape", () => {
  assert.equal(normalise("How do backups work"), "how do backups work");
});

test("punctuation with no letters or digits is refused", () => {
  assert.equal(normalise("???"), null);
  assert.equal(normalise("--- ---"), null);
});

test("a non-string is refused rather than coerced", () => {
  assert.equal(normalise(undefined), null);
  assert.equal(normalise(null), null);
  assert.equal(normalise(42), null);
});

/*
 * THE CONTROL. These refusals are only worth anything if the function can also SAY YES; a
 * normaliser that returned null for everything would pass every assertion above.
 */
test("the refusals discriminate: ordinary queries still get through", () => {
  const kept = ["d1 backups", "how do backups work", "phage cocktail", "workers cache"].map(normalise);
  assert.ok(
    kept.every((q) => typeof q === "string" && q.length > 0),
    "a normaliser that refused everything would satisfy every refusal test above",
  );
});

test("the case tests run BEFORE lowercasing, or the name shape sees nothing", () => {
  /* Guards the ordering inside the function: lowercase first and NAME_SHAPE can never match. */
  assert.equal(normalise("Jane Smith"), null);
  assert.equal(normalise("jane smith"), "jane smith");
});
