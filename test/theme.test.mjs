/* Pure functions of a Request, so they run here rather than in the workerd pool. */

import test from "node:test";
import assert from "node:assert/strict";

import { colorSchemeMeta, themeAttribute, themeFromRequest } from "../app/lib/theme.ts";

/** @param {string} [cookie] */
const request = (cookie) =>
  new Request("https://example.com/", cookie === undefined ? {} : { headers: { cookie } });

test("a legacy system cookie resolves to exactly the no-cookie state", () => {
  /* A legacy `theme=system` cookie means "follow the machine", which is what no cookie means,
   * so both readers must receive the same document. */
  const cookieless = themeFromRequest(request());
  const legacy = themeFromRequest(request("theme=system"));
  assert.equal(legacy, cookieless);

  /* THE ATTRIBUTE IS ABSENT FOR BOTH, which is what makes the two documents
   * byte-identical and lets them share one cache entry. */
  assert.equal(themeAttribute(legacy), undefined);
  assert.equal(themeAttribute(cookieless), undefined);

  /* And the meta still says the document supports both, which is the honest
   * answer for a reader who has chosen nothing. */
  assert.equal(colorSchemeMeta(legacy), "light dark");
});

test("THREE resolved states are kept, because the cache key still carries them", () => {
  /* `workers/app.ts` keys its cache on this value, so light, dark and the default must stay
   * three distinct answers. */
  const dark = themeFromRequest(request("theme=dark"));
  const light = themeFromRequest(request("theme=light"));
  const none = themeFromRequest(request());
  assert.equal(new Set([dark, light, none]).size, 3);
  assert.equal(themeAttribute(dark), "dark");
  assert.equal(themeAttribute(light), "light");
});

test("junk in the cookie is the default, never the page failing", () => {
  assert.equal(themeAttribute(themeFromRequest(request("theme=%%%bogus"))), undefined);
});
