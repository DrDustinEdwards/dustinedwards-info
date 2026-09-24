/* Security-critical: the publish policy's "ever public" answer comes from the committed file,
 * and this is what overwrites whatever the request claimed. */

import test from "node:test";
import assert from "node:assert/strict";

import matter from "gray-matter";

import { forceFirstPublished, readState } from "../app/lib/editor/publish-policy.mjs";

/**
 * Dates flattened to their ISO day so a `Date` and the string that produced it compare equal.
 *
 * @param {string} raw
 */
function fields(raw) {
  const data = /** @type {Record<string, unknown>} */ (matter(raw).data);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(data).sort()) {
    const value = data[key];
    out[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return out;
}

const body = (/** @type {string} */ raw) => matter(raw).content;

/**
 * @param {string} input
 * @param {string | null} value
 */
function roundTrip(input, value) {
  const output = forceFirstPublished(input, value);

  const want = fields(input);
  if (value) want.first_published = value;
  else delete want.first_published;

  assert.deepEqual(fields(output), want, "the frontmatter is not what was asked for");
  assert.equal(body(output), body(input), "the body changed");
  assert.equal(
    readState(output).firstPublished,
    value,
    "readState disagrees with the stamp, which is the pair the policy runs on",
  );
  return output;
}

const PLAIN = `---
title: "A post"
slug: a-post
draft: false
tags: [cloudflare, d1]
---

The body, with a --- line inside it that must not be read as a delimiter.

More body.
`;

test("stamps a value into frontmatter that has no such key", () => {
  const out = roundTrip(PLAIN, "2026-08-28");
  assert.match(out, /^first_published: 2026-08-28$/m);
});

test("overwrites a value the document already carried", () => {
  const seeded = PLAIN.replace("draft: false", "draft: false\nfirst_published: 2020-01-01");
  const out = roundTrip(seeded, "2026-08-28");
  assert.doesNotMatch(out, /2020-01-01/, "the old value survived, which is the security case");
});

test("removes the key when the value is null", () => {
  const seeded = PLAIN.replace("draft: false", "draft: false\nfirst_published: 2020-01-01");
  const out = roundTrip(seeded, null);
  assert.doesNotMatch(out, /first_published/, "the key survived a null stamp");
});

test("an unquoted YAML date survives as the same day", () => {
  // gray-matter hands this back as a Date, not a string, which is why the
  // comparison in the implementation normalizes before comparing.
  const dated = PLAIN.replace("draft: false", "draft: false\ndate: 2026-07-30");
  const out = roundTrip(dated, "2026-08-28");
  assert.equal(fields(out).date, "2026-07-30");
});

test("a document with no frontmatter is returned untouched", () => {
  const bare = "Just a body.\n";
  assert.equal(forceFirstPublished(bare, "2026-08-28"), bare);
});

/** A QUOTED KEY. The anchor misses it, so the edit appends a DUPLICATE. */
const QUOTED_KEY = `---
title: "A post"
"first_published": 2020-01-01
---

Body.
`;

/**
 * A LIST VALUE, with an UNQUOTED title above it, which is what makes this the
 * silent case rather than a thrown one. The edit removes the key line and
 * orphans its items onto the key above.
 */
const LIST_VALUE = `---
title: A post
first_published:
  - 2020-01-01
---

Body.
`;

test("A QUOTED KEY: the edit would append a duplicate and break the document", () => {
  // The naive edit leaves `"first_published"` in place and adds a second key, which YAML refuses.
  const out = roundTrip(QUOTED_KEY, "2026-08-28");
  assert.doesNotMatch(out, /2020-01-01/, "the old value survived, which is the security case");
});

test("A LIST VALUE: the edit would orphan the items onto the key above", () => {
  /* Does not throw: removing the key line folds `  - 2020-01-01` into the preceding key, so
   * the post's TITLE silently becomes "A post - 2020-01-01". */
  const out = roundTrip(LIST_VALUE, "2026-08-28");
  assert.equal(fields(out).title, "A post", "the title was corrupted by the stamp");
});
