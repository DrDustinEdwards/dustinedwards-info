/**
 * Where the no-script theme toggle sends a reader back to.
 *
 * ## THE DEFECT THIS REPLAYS
 *
 * The fragment was dropped, so the scriptless toggle returned a reader to the
 * TOP of whatever they were reading. On a long post that is the worst place to
 * land: the reader was somewhere specific, asked for a color, and was sent
 * back to the beginning. The scripted path never had the problem, because it
 * never navigates, so the cost fell entirely on the readers the fallback exists
 * for.
 *
 * ## AND THE REFUSALS IT MUST NOT LOSE
 *
 * This function's other job is refusing a hostile `Referer`. Keeping the hash
 * is a widening, and a widening is exactly when the refusals are worth
 * asserting: the whole file is here rather than only the new behavior, so a
 * later edit cannot trade one for the other. It was private to a TypeScript
 * route until 2026-08-28, which is why none of this was covered.
 *
 * @see app/lib/return-to.mjs
 * @see app/routes/theme.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { safeReturnTo } from "../app/lib/return-to.mjs";

const SITE = "https://dustinedwards.dustin-edwards.workers.dev";

/** A POST to /theme carrying `referer`, or none. */
const post = (referer) =>
  new Request(`${SITE}/theme`, {
    method: "POST",
    headers: referer === null ? {} : { referer },
  });

test("CONTROL: an ordinary same-origin path is returned", () => {
  // Without this every refusal below could pass on a function that returned
  // "/" unconditionally, which is a broken toggle rather than a safe one.
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
  /*
   * Headings are slugged, so a fragment can carry encoded bytes. This function
   * ECHOES the fragment rather than parsing it, exactly as it does the query;
   * decoding would be this function having an opinion about a heading id.
   */
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
  /*
   * `new URL("https://site//evil.com")` has pathname `//evil.com`, and
   * `Location: //evil.com` is resolved by the browser against ANOTHER HOST. The
   * origin check does not catch it, because the origin really is ours.
   */
  assert.equal(safeReturnTo(post(`${SITE}//evil.com`)), "/");
  assert.equal(safeReturnTo(post(`${SITE}//evil.com#anchor`)), "/");
});

test("an unparseable Referer is refused rather than thrown on", () => {
  assert.equal(safeReturnTo(post("not a url")), "/");
});
