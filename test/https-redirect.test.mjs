/**
 * Plaintext requests, and why the redirect must not be cacheable.
 *
 * The audit's claim, verified TRUE on the wire at HEAD before this landed:
 * http:// returned 200 with the full page, and the first plaintext request to a
 * path already warmed over HTTPS came back CF-Cache-Status: HIT carrying the
 * same CSP nonce. The schemes shared a cache entry.
 *
 * @see app/lib/https-redirect.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { httpsRedirectStatus, httpsRedirectTarget } from "../app/lib/https-redirect.mjs";

test("plaintext is redirected, path and query intact", () => {
  assert.equal(
    httpsRedirectTarget("http://dustinedwards.dustin-edwards.workers.dev/blog?tag=d1&page=2"),
    "https://dustinedwards.dustin-edwards.workers.dev/blog?tag=d1&page=2",
  );
});

test("HTTPS is left alone, or every request would loop", () => {
  assert.equal(httpsRedirectTarget("https://dustinedwards.dustin-edwards.workers.dev/"), null);
});

test("LOOPBACK IS EXEMPT, or local development breaks", () => {
  // `npm run dev` serves http://localhost:5173. Redirecting it sends the
  // developer to a port where nothing is listening.
  for (const url of [
    "http://localhost:5173/",
    "http://127.0.0.1:8787/admin",
    "http://[::1]:5173/",
    "http://site.localhost/",
  ]) {
    assert.equal(httpsRedirectTarget(url), null, `${url} must not redirect`);
  }
});

test("a loopback-LOOKING public host is NOT exempt", () => {
  // The exemption is an exact hostname set plus a .localhost suffix, not a
  // substring test, so this must still redirect.
  assert.equal(
    httpsRedirectTarget("http://localhost.evil.com/"),
    "https://localhost.evil.com/",
  );
});

test("an unparseable URL falls through rather than throwing", () => {
  assert.equal(httpsRedirectTarget("not a url"), null);
});

test("THE METHOD DECIDES THE STATUS: a POST keeps its body", () => {
  // A 301 permits a client to turn a POST into a GET, which would silently
  // drop the no-script sign-in form's body.
  assert.equal(httpsRedirectStatus("GET"), 301);
  assert.equal(httpsRedirectStatus("HEAD"), 301);
  assert.equal(httpsRedirectStatus("POST"), 308);
  assert.equal(httpsRedirectStatus("DELETE"), 308);
  assert.equal(httpsRedirectStatus("get"), 301, "case must not decide it");
  assert.equal(httpsRedirectStatus(undefined), 308, "unknown method keeps the body");
});

test("a non-standard port survives the upgrade", () => {
  assert.equal(httpsRedirectTarget("http://example.com:8080/x"), "https://example.com:8080/x");
});
