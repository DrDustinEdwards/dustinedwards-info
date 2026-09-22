/**
 * The renamed-post redirect predicate.
 *
 * `check:urls` already drives this against the REAL map and the real corpus,
 * and that is the assertion with teeth: it is what catches a redirect into a
 * 404 or a post claiming a retired slug. This file exists for the half that
 * gate cannot reach.
 *
 * The gate can only ever ask "what does the predicate do with the nine entries
 * that happen to be live today". A map the TEST writes can ask what it does
 * with an entry whose target is empty, a key that is not an own property, or a
 * path that merely starts the same way. Those are the cases that decide whether
 * the predicate is correct rather than merely correct-for-now, and every one of
 * them would need a deliberately broken `content/redirects.json` to express
 * through the gate.
 *
 * @see app/lib/slug-redirect.mjs
 * @see scripts/check-urls.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { postRedirectStatus, postRedirectTarget } from "../app/lib/slug-redirect.mjs";

const MAP = { "old-post": "new-post", "another-old": "another-new" };

test("an entry resolves, and carries the markdown twin with it", () => {
  assert.equal(postRedirectTarget("/blog/old-post", MAP), "/blog/new-post");
  assert.equal(postRedirectTarget("/blog/old-post.md", MAP), "/blog/new-post.md");
  assert.equal(postRedirectTarget("/blog/another-old", MAP), "/blog/another-new");
});

test("a slug that is not in the map is not this module's business", () => {
  assert.equal(postRedirectTarget("/blog/some-live-post", MAP), null);
  assert.equal(postRedirectTarget("/blog/some-live-post.md", MAP), null);
});

test("paths outside /blog/ are declined", () => {
  for (const path of ["/", "/projects", "/blog", "/blogold-post", "/admin/blog/old-post"]) {
    assert.equal(postRedirectTarget(path, MAP), null, path);
  }
});

/**
 * PLANT 1: the inherited-key hazard.
 *
 * A bare `map[slug]` lookup answers from `Object.prototype`, so
 * `/blog/constructor` would 301 to `/blog/function Object() { [native code] }`.
 *
 * **This case alone does not isolate `Object.hasOwn`, and saying so is the
 * point.** Measured 2026-09-09 by replacing the guard with `map[slug] ===
 * undefined`: these keys stayed declined and this test stayed GREEN, because
 * their values are functions and the `typeof target !== "string"` check below
 * them refuses on that instead. Two guards, one observable behavior, and only
 * the second one was load-bearing for these names. The next test is the one
 * that tells them apart.
 */
test("PLANT 1: inherited properties are not redirects", () => {
  for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
    assert.equal(postRedirectTarget(`/blog/${key}`, MAP), null, key);
    assert.equal(postRedirectTarget(`/blog/${key}.md`, MAP), null, `${key}.md`);
  }
});

/**
 * PLANT 1b: THE CASE THAT ISOLATES `Object.hasOwn`.
 *
 * A polluted prototype whose value is a STRING passes the type check cleanly,
 * so the own-property test is the only thing standing between it and a live
 * 301 to an attacker-chosen path. Verified to discriminate: with the guard
 * replaced by `map[slug] === undefined` this assertion FAILS, and it is the
 * only one in the file that does.
 *
 * The pollution is undone in a `finally`, because leaving `Object.prototype`
 * modified would silently change every later test in the run, including tests
 * in other files sharing the process.
 */
test("PLANT 1b: a string-valued inherited key is still not a redirect", () => {
  try {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, "polluted", {
      value: "attacker-chosen",
      configurable: true,
      enumerable: false,
      writable: true,
    });
    assert.equal(/** @type {any} */ ({}).polluted, "attacker-chosen", "the plant did not apply");
    assert.equal(postRedirectTarget("/blog/polluted", MAP), null);
    assert.equal(postRedirectTarget("/blog/polluted.md", MAP), null);
  } finally {
    delete (/** @type {any} */ (Object.prototype).polluted);
  }
});

/**
 * PLANT 2: a sibling route must not be swallowed.
 *
 * `/blog/tags/:tag` and `/blog/series/:series` live under the same prefix. The
 * predicate refuses anything with a slash in the remainder rather than relying
 * on the lookup to miss, so a future map entry containing a slash cannot start
 * matching another route's URLs.
 */
test("PLANT 2: nested blog routes are never claimed", () => {
  const hostile = { "tags/cloudflare": "somewhere", "series/x": "elsewhere" };
  assert.equal(postRedirectTarget("/blog/tags/cloudflare", hostile), null);
  assert.equal(postRedirectTarget("/blog/series/x", hostile), null);
  assert.equal(postRedirectTarget("/blog/tags/cloudflare", MAP), null);
});

test("a malformed entry is declined rather than producing a broken Location", () => {
  assert.equal(postRedirectTarget("/blog/a", { a: "" }), null);
  assert.equal(postRedirectTarget("/blog/a", { a: null }), null);
  assert.equal(postRedirectTarget("/blog/a", { a: 7 }), null);
});

test("a missing or non-object map is declined, never thrown", () => {
  assert.equal(postRedirectTarget("/blog/old-post", undefined), null);
  assert.equal(postRedirectTarget("/blog/old-post", null), null);
  assert.equal(postRedirectTarget(undefined, MAP), null);
});

test("only the trailing .md is treated as the twin", () => {
  // A slug that merely CONTAINS .md is not a twin of some other slug.
  assert.equal(postRedirectTarget("/blog/x.md.md", { "x.md": "y" }), "/blog/y.md");
  assert.equal(postRedirectTarget("/blog/read.md-notes", { "read.md-notes": "y" }), "/blog/y");
});

test("301 for GET and HEAD, 308 for anything that could carry a body", () => {
  assert.equal(postRedirectStatus("GET"), 301);
  assert.equal(postRedirectStatus("HEAD"), 301);
  assert.equal(postRedirectStatus("get"), 301);
  assert.equal(postRedirectStatus("POST"), 308);
  assert.equal(postRedirectStatus("PUT"), 308);
  assert.equal(postRedirectStatus(undefined), 308);
});
