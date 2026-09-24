import test from "node:test";
import assert from "node:assert/strict";

import { safeReturnTo } from "../app/lib/return-to.mjs";

const SITE = "https://dustinedwards.dustin-edwards.workers.dev";

const post = (referer) =>
  new Request(`${SITE}/theme`, {
    method: "POST",
    headers: referer === null ? {} : { referer },
  });

test("CONTROL: an ordinary same-origin path is returned", () => {
  assert.equal(safeReturnTo(post(`${SITE}/blog/ten-years-on-cloudflare`)), "/blog/ten-years-on-cloudflare");
});

test("THE FRAGMENT IS KEPT, which is the defect", () => {
  assert.equal(
    safeReturnTo(post(`${SITE}/blog/ten-years-on-cloudflare#the-numbers`)),
    "/blog/ten-years-on-cloudflare#the-numbers",
  );
});

test("the query survives alongside the fragment", () => {
  assert.equal(
    safeReturnTo(post(`${SITE}/blog?tag=d1&page=2#post-list`)),
    "/blog?tag=d1&page=2#post-list",
  );
});

test("a percent-encoded fragment is echoed, not decoded", () => {
  /* This function ECHOES the fragment rather than parsing it, exactly as it does the query:
   * decoding would be having an opinion about a heading id. */
  const out = safeReturnTo(post(`${SITE}/blog/a#a%20b`));
  assert.equal(out, "/blog/a#a%20b");
});

test("no Referer means the site root", () => {
  assert.equal(safeReturnTo(post(null)), "/");
});

test("A FOREIGN ORIGIN IS REFUSED, fragment or not", () => {
  assert.equal(safeReturnTo(post("https://evil.example/blog#x")), "/");
  assert.equal(safeReturnTo(post("http://dustinedwards.dustin-edwards.workers.dev/blog")), "/");
});

test("a protocol-relative path is refused", () => {
  /* `new URL("https://site//evil.com")` has pathname `//evil.com`, and `Location: //evil.com`
   * resolves against ANOTHER HOST. The origin check misses it: the origin really is ours. */
  assert.equal(safeReturnTo(post(`${SITE}//evil.com`)), "/");
  assert.equal(safeReturnTo(post(`${SITE}//evil.com#anchor`)), "/");
});

test("an unparseable Referer is refused rather than thrown on", () => {
  assert.equal(safeReturnTo(post("not a url")), "/");
});
