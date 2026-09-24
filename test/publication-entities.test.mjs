/**
 * Registry text reads as text, and escaped-twice text stays escaped once.
 *
 * ## THE DEFECT THIS REPLAYS
 *
 * The publications page rendered `{italicizeOrganisms(p.abstract)}`, React set
 * it as text, and six character references in the corpus reached readers
 * spelt out: `p &lt; 0.05` in the phage therapy abstract, four `&gt;` in phage
 * announcements, and `&amp;` in a journal name. Shipping since July.
 *
 * ## THE HALF THAT IS EASY TO GET WRONG
 *
 * The naive repair is two replacements, `&lt;` then `&amp;`. Against
 * `&amp;lt;` that yields `<`: text somebody escaped twice on purpose comes back
 * as markup, one level too far. The single-pass case below is the one that
 * fails against that implementation and passes against this one, so it is the
 * reason this file exists rather than a courtesy test.
 *
 * The stored corpus keeps its escapes on purpose: `check:machine-readable` asserts
 * no stored abstract contains a left angle bracket, which is what keeps a
 * registry string safe in the JSON-LD block and in the exports. So the fixture
 * here is deliberately the ESCAPED form, which is what the data file holds.
 *
 * @see app/lib/publications/entities.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { decodeEntities } from "../app/lib/publications/entities.mjs";

test("the five XML predefined entities decode", () => {
  assert.equal(decodeEntities("a &amp; b"), "a & b");
  assert.equal(decodeEntities("p &lt; 0.05"), "p < 0.05");
  assert.equal(decodeEntities("shares &gt;99% identity"), "shares >99% identity");
  assert.equal(decodeEntities("&quot;quoted&quot;"), '"quoted"');
  assert.equal(decodeEntities("it&apos;s"), "it's");
});

test("ONE PASS: text escaped twice comes back escaped once, not zero times", () => {
  // The case a two-step replace gets wrong. `&amp;lt;` is how a registry
  // deposits the literal text "&lt;", and it must survive as that text.
  assert.equal(decodeEntities("&amp;lt;"), "&lt;");
  assert.equal(decodeEntities("&amp;amp;"), "&amp;");
  // And the replacement is never rescanned, so a decoded `&` cannot team up
  // with following characters to form a new reference.
  assert.equal(decodeEntities("&amp;gt; is not a tag"), "&gt; is not a tag");
});

test("numeric references decode, in decimal and hex", () => {
  assert.equal(decodeEntities("&#60;"), "<");
  assert.equal(decodeEntities("&#x3C;"), "<");
  assert.equal(decodeEntities("&#X3c;"), "<");
  // Astral plane, which is where fromCodePoint differs from fromCharCode.
  assert.equal(decodeEntities("&#128169;").codePointAt(0), 128169);
});

test("an impossible code point is left verbatim rather than thrown", () => {
  // String.fromCodePoint THROWS on these. A registry typo must not take down a
  // page render, so the range is checked before the call.
  assert.equal(decodeEntities("&#1114112;"), "&#1114112;");
  assert.equal(decodeEntities("&#xFFFFFFFF;"), "&#xFFFFFFFF;");
  // A lone surrogate is a valid integer and an invalid string.
  assert.equal(decodeEntities("&#55296;"), "&#55296;");
});

test("an unknown name is left verbatim, because a guess would be worse", () => {
  assert.equal(decodeEntities("&nbsp;"), "&nbsp;");
  assert.equal(decodeEntities("&foo;"), "&foo;");
  // Case matters: the XML predefined entities are lower case.
  assert.equal(decodeEntities("&AMP;"), "&AMP;");
});

test("text carrying no reference is returned unchanged", () => {
  const plain = "Microbacteriophage Godfather was collected from a soil sample.";
  assert.equal(decodeEntities(plain), plain);
});

test("null and undefined are the empty string, never the word null", () => {
  assert.equal(decodeEntities(null), "");
  assert.equal(decodeEntities(undefined), "");
});

test("the real corpus strings, which is what this was written for", () => {
  assert.equal(
    decodeEntities("Journal of Microbiology &amp; Biology Education"),
    "Journal of Microbiology & Biology Education",
  );
  assert.equal(
    decodeEntities("confidence in recommending it (p &lt; 0.05)"),
    "confidence in recommending it (p < 0.05)",
  );
});
