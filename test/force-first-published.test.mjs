/**
 * `forceFirstPublished` round-trips through the YAML parser.
 *
 * The stamp is security-critical: the publish policy asks whether a post has
 * ever been public, the answer must come from the committed file rather than
 * from the request, and this function is what overwrites whatever the request
 * claimed. A stamp that silently corrupted the frontmatter would take the
 * post's other fields with it.
 *
 * ## WHAT IS TESTED, and the last case is the one that matters
 *
 * Every case asserts the ROUND TRIP: parse the output, and compare it against
 * the input's own parse with exactly this one key changed. That is a stronger
 * assertion than string equality on the output, because it does not care how
 * the value was written, only that the document now says the right thing and
 * says everything else unchanged.
 *
 * The last two cases are the ones the line edit gets wrong, and they were FOUND
 * rather than reasoned about. Several likelier-looking candidates did not
 * discriminate: a folded scalar's continuation lines are indented, so the `^`
 * anchor already misses them, and an appended key at column zero correctly ends
 * the scalar above it. YAML's own indentation rules make the line edit safer
 * than it looks, which is why the two real cases each carry a control showing
 * the old body producing the wrong answer on the same input.
 *
 * @see app/lib/editor/publish-policy.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import matter from "gray-matter";

import { forceFirstPublished, readState } from "../app/lib/editor/publish-policy.mjs";

/**
 * The frontmatter as YAML understands it, with dates flattened to their ISO day
 * so a `Date` and the string that produced it compare equal.
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

/** The body, as gray-matter separates it. */
const body = (/** @type {string} */ raw) => matter(raw).content;

/**
 * Asserts the round trip: one key changed, everything else identical.
 *
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
  // comparison in the implementation normalises before comparing.
  const dated = PLAIN.replace("draft: false", "draft: false\ndate: 2026-07-30");
  const out = roundTrip(dated, "2026-08-28");
  assert.equal(fields(out).date, "2026-07-30");
});

test("a document with no frontmatter is returned untouched", () => {
  const bare = "Just a body.\n";
  assert.equal(forceFirstPublished(bare, "2026-08-28"), bare);
});

/**
 * The old body, lifted verbatim, so the two documents below can be shown to
 * discriminate rather than asserted to.
 *
 * @param {string} raw
 * @param {string | null} value
 */
function naiveLineEdit(raw, value) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match?.[1]) return raw;
  const rest = raw.slice(match[0].length);
  const kept = match[1].split("\n").filter((line) => !/^first_published\s*:/.test(line));
  if (value) kept.push(`first_published: ${value}`);
  return `---\n${kept.join("\n")}\n---\n${rest}`;
}

/*
 * THE TWO DOCUMENTS THE LINE EDIT GETS WRONG.
 *
 * They were FOUND rather than reasoned about, and the first several candidates
 * did not discriminate: a folded scalar's continuation lines are indented, so
 * the `^` anchor already misses them, and an appended key at column zero
 * correctly ends the scalar above it. YAML's own indentation rules make the
 * line edit safer than it looks.
 *
 * These two are real, and the second is the dangerous one.
 */

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

test("the controls: the line edit really does corrupt both documents", () => {
  // Without this, the two cases below are satisfied by any implementation at
  // all, including one that never had the defect.
  assert.throws(
    () => matter(naiveLineEdit(QUOTED_KEY, "2026-08-28")),
    /duplicated mapping key/,
    "the quoted-key document no longer produces a duplicate, so it does not discriminate",
  );
  assert.equal(
    fields(naiveLineEdit(LIST_VALUE, "2026-08-28")).title,
    "A post - 2020-01-01",
    "the list-value document no longer corrupts the title, so it does not discriminate",
  );
});

test("A QUOTED KEY: the edit would append a duplicate and break the document", () => {
  // The naive edit leaves `"first_published"` in place and adds a second key,
  // which YAML refuses outright. A post that cannot be parsed is a post the
  // next build fails on, broken by the stamp itself.
  const out = roundTrip(QUOTED_KEY, "2026-08-28");
  assert.doesNotMatch(out, /2020-01-01/, "the old value survived, which is the security case");
});

test("A LIST VALUE: the edit would orphan the items onto the key above", () => {
  /*
   * THE DANGEROUS ONE, because it does not throw. Removing the
   * `first_published:` line leaves `  - 2020-01-01` behind, and YAML folds it
   * into the preceding key: the post's TITLE silently becomes
   * "A post - 2020-01-01". A stamp that renames a published post is exactly the
   * failure a security-critical overwrite must not have.
   */
  const out = roundTrip(LIST_VALUE, "2026-08-28");
  assert.equal(fields(out).title, "A post", "the title was corrupted by the stamp");
});
