import test from "node:test";
import assert from "node:assert/strict";

import { safeReturnTo } from "../app/lib/return-to.mjs";

const SITE = "https://dustinedwards.dustin-edwards.workers.dev";

const post = (referer) =>
  new Request(`${SITE}/theme`, {
    method: "POST",
    headers: referer === null ? {} : { referer },
  });

await test("THE FRAGMENT IS KEPT, which is the defect", () => {
  assert.equal(
    safeReturnTo(post(`${SITE}/writing/ten-years-on-cloudflare#the-numbers`)),
    "/writing/ten-years-on-cloudflare#the-numbers",
  );
});

await test("the query survives alongside the fragment", () => {
  assert.equal(
    safeReturnTo(post(`${SITE}/writing?tag=d1&page=2#post-list`)),
    "/writing?tag=d1&page=2#post-list",
  );
});

await test("no Referer means the site root", () => {
  assert.equal(safeReturnTo(post(null)), "/");
});

await test("A FOREIGN ORIGIN IS REFUSED, fragment or not", () => {
  assert.equal(safeReturnTo(post("https://evil.example/blog#x")), "/");
  assert.equal(safeReturnTo(post("http://dustinedwards.dustin-edwards.workers.dev/blog")), "/");
});

await test("a protocol-relative path is refused", () => {
  /* `new URL("https://site//evil.com")` has pathname `//evil.com`, and `Location: //evil.com`
   * resolves against ANOTHER HOST. The origin check misses it: the origin really is ours. */
  assert.equal(safeReturnTo(post(`${SITE}//evil.com`)), "/");
  assert.equal(safeReturnTo(post(`${SITE}//evil.com#anchor`)), "/");
});

await test("an unparseable Referer is refused rather than thrown on", () => {
  assert.equal(safeReturnTo(post("not a url")), "/");
});
