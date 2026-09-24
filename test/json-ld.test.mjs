/* The contents of a `<script>` are RAW TEXT, ended only by `</script`. Every escaping assertion
 * is paired with a parse, since an escaper that mangled the payload would pass the first half. */

import test from "node:test";
import assert from "node:assert/strict";

import { jsonLd } from "../app/lib/json-ld.mjs";

/* U+2028 and U+2029 are invisible, so a literal could be replaced in transit and this file would
 * test nothing. `String.fromCharCode` cannot be mangled that way. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

test("CONTROL: ordinary data round-trips unchanged", () => {
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
  /* The site's blocks nest arrays inside objects, so an escaper that only looked at one level
   * would pass on a flat fixture and fail on every real page. */
  const value = [{ "@graph": [{ name: "<x>" }, { items: ["</script>"] }] }];
  const out = jsonLd(value);
  assert.ok(!out.includes("<") && !out.includes(">"), out);
  assert.deepEqual(JSON.parse(out), value);
});
