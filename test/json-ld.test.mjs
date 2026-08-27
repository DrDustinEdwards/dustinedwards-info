/**
 * JSON that goes inside a `<script>` element cannot close it.
 *
 * ## THE DEFECT THIS REPLAYS
 *
 * Every JSON-LD block on the site was `JSON.stringify(...)` handed straight to
 * `dangerouslySetInnerHTML`. The contents of a `<script>` element are RAW TEXT:
 * the parser decodes no entities inside it, and the only thing that ends it is
 * the literal sequence `</script`. A post title carrying that sequence closes
 * the element early, and everything after it is parsed as markup.
 *
 * Titles come from frontmatter, written by the one admin and by the operator
 * API, so this was hardening rather than a live hole. The test exists because
 * "no title will ever contain an angle bracket" is not a property anything
 * enforces.
 *
 * ## THE TWO HALVES
 *
 * Escaping is only half of correct. The other half is that the escapes do not
 * change the DATA: `<` is a valid JSON string escape that parses back to
 * `<`, so every assertion about what is escaped is paired with parsing the
 * output and comparing the object. An escaper that mangled the payload would
 * satisfy the first half perfectly.
 *
 * @see app/lib/json-ld.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { jsonLd } from "../app/lib/json-ld.mjs";

/*
 * BUILT FROM ESCAPES, not pasted as characters, for the reason the helper's own
 * comment gives: U+2028 and U+2029 are invisible, so a literal here could be
 * replaced by a space in transit and this file would still pass while testing
 * nothing. `String.fromCharCode` cannot be mangled that way.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

test("CONTROL: ordinary data round-trips unchanged", () => {
  // Without this, every escaping assertion below could pass on a function that
  // returned a constant.
  const value = { "@type": "Article", headline: "Ten years on Cloudflare", n: 12 };
  assert.deepEqual(JSON.parse(jsonLd(value)), value);
  assert.equal(jsonLd(value), JSON.stringify(value));
});

test("A TITLE CARRYING </script> CANNOT CLOSE THE ELEMENT", () => {
  const value = { headline: "A post called </script><script>alert(1)</script>" };
  const out = jsonLd(value);
  assert.ok(!out.includes("</script"), `the closing sequence survived: ${out}`);
  assert.ok(!out.includes("<"), `a raw < survived: ${out}`);
  assert.ok(!out.includes(">"), `a raw > survived: ${out}`);
});

test("and the payload is unchanged, which is the half escaping can get wrong", () => {
  const value = { headline: "A post called </script><script>alert(1)</script>" };
  assert.deepEqual(JSON.parse(jsonLd(value)), value);
});

test("ampersands are escaped and still parse back", () => {
  const value = { headline: "Tags & topics" };
  assert.ok(!jsonLd(value).includes("&"));
  assert.deepEqual(JSON.parse(jsonLd(value)), value);
});

test("U+2028 and U+2029 are escaped and still parse back", () => {
  const value = { headline: `line${LINE_SEPARATOR}break${PARAGRAPH_SEPARATOR}para` };
  const out = jsonLd(value);
  assert.ok(!out.includes(LINE_SEPARATOR), "a raw line separator survived");
  assert.ok(!out.includes(PARAGRAPH_SEPARATOR), "a raw paragraph separator survived");
  assert.deepEqual(JSON.parse(out), value);
});

test("escaping reaches nested values, not just the top level", () => {
  /*
   * The site's blocks are arrays of objects with arrays inside them, so an
   * escaper that only looked at one level would pass on a flat fixture and
   * fail on every real page.
   */
  const value = [{ "@graph": [{ name: "<x>" }, { items: ["</script>"] }] }];
  const out = jsonLd(value);
  assert.ok(!out.includes("<") && !out.includes(">"), out);
  assert.deepEqual(JSON.parse(out), value);
});
