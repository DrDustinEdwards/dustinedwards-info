import test from "node:test";
import assert from "node:assert/strict";

import { postRedirectStatus, postRedirectTarget } from "../app/lib/slug-redirect.mjs";

const MAP = { "old-post": "new-post", "another-old": "another-new" };

test("an entry resolves, and carries the markdown twin with it", () => {
  assert.equal(postRedirectTarget("/writing/old-post", MAP), "/writing/new-post");
  assert.equal(postRedirectTarget("/writing/old-post.md", MAP), "/writing/new-post.md");
  assert.equal(postRedirectTarget("/writing/another-old", MAP), "/writing/another-new");
});

test("a slug that is not in the map is not this module's business", () => {
  assert.equal(postRedirectTarget("/writing/some-live-post", MAP), null);
  assert.equal(postRedirectTarget("/writing/some-live-post.md", MAP), null);
});

test("paths outside /writing/ are declined", () => {
  for (const path of ["/", "/projects", "/writing", "/blogold-post", "/admin/blog/old-post"]) {
    assert.equal(postRedirectTarget(path, MAP), null, path);
  }
});

/* A bare `map[slug]` answers from `Object.prototype`. These values are functions, so the type
 * check refuses them too; the next test is the one that isolates `Object.hasOwn`. */
test("PLANT 1: inherited properties are not redirects", () => {
  for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
    assert.equal(postRedirectTarget(`/writing/${key}`, MAP), null, key);
    assert.equal(postRedirectTarget(`/writing/${key}.md`, MAP), null, `${key}.md`);
  }
});

/* A polluted STRING passes the type check, so only the own-property test stands between it and
 * a 301 to an attacker's path. Undone in `finally`: the prototype is shared by every later test. */
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
    assert.equal(postRedirectTarget("/writing/polluted", MAP), null);
    assert.equal(postRedirectTarget("/writing/polluted.md", MAP), null);
  } finally {
    delete (/** @type {any} */ (Object.prototype).polluted);
  }
});

/* Any slash in the remainder is refused, so a future map entry with one cannot swallow
 * `/writing/tags/:tag` or `/writing/series/:series`. */
test("PLANT 2: nested blog routes are never claimed", () => {
  const hostile = { "tags/cloudflare": "somewhere", "series/x": "elsewhere" };
  assert.equal(postRedirectTarget("/writing/tags/cloudflare", hostile), null);
  assert.equal(postRedirectTarget("/writing/series/x", hostile), null);
  assert.equal(postRedirectTarget("/writing/tags/cloudflare", MAP), null);
});

test("a malformed entry is declined rather than producing a broken Location", () => {
  assert.equal(postRedirectTarget("/writing/a", { a: "" }), null);
  assert.equal(postRedirectTarget("/writing/a", { a: null }), null);
  assert.equal(postRedirectTarget("/writing/a", { a: 7 }), null);
});

test("a missing or non-object map is declined, never thrown", () => {
  assert.equal(postRedirectTarget("/writing/old-post", undefined), null);
  assert.equal(postRedirectTarget("/writing/old-post", null), null);
  assert.equal(postRedirectTarget(undefined, MAP), null);
});

test("only the trailing .md is treated as the twin", () => {
  // A slug that merely CONTAINS .md is not a twin of some other slug.
  assert.equal(postRedirectTarget("/writing/x.md.md", { "x.md": "y" }), "/writing/y.md");
  assert.equal(postRedirectTarget("/writing/read.md-notes", { "read.md-notes": "y" }), "/writing/y");
});

test("301 for GET and HEAD, 308 for anything that could carry a body", () => {
  assert.equal(postRedirectStatus("GET"), 301);
  assert.equal(postRedirectStatus("HEAD"), 301);
  assert.equal(postRedirectStatus("get"), 301);
  assert.equal(postRedirectStatus("POST"), 308);
  assert.equal(postRedirectStatus("PUT"), 308);
  assert.equal(postRedirectStatus(undefined), 308);
});
