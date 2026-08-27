/**
 * A related-posts list names nothing the public cannot already see.
 *
 * ## THE DEFECT THIS REPLAYS
 *
 * `withRelated` filtered on `!other.draft`, which is ONE of the two facts that
 * make a post public. A SCHEDULED post is not a draft: its status is published
 * and its `publish_at` is in the future. It passed the filter, so its title and
 * its URL could be written into the related list of a post that is already
 * live, and rendered on a public page for something nobody is meant to see yet.
 * That is the 2026-07-29 draft leak arriving down a third road, after the row
 * reads and the Ask upload path.
 *
 * ## WHY THE FIX IS IN TWO PLACES
 *
 * This list is computed at WRITE time and stored on the row. Composing the
 * visibility rule here stops a scheduled post ever entering a list. It cannot
 * stop a post being unpublished AFTER a list naming it was written, because
 * nothing rewrites its neighbours' lists when that happens, so `blog.$slug.tsx`
 * re-checks the stored list against the live rows before rendering. This file
 * covers the write half; the read half needs a database and is covered by
 * `check:browser` against the preview.
 *
 * @see app/lib/content/pipeline.mjs withRelated
 * @see app/lib/search/visibility.mjs isPubliclyVisible
 */

import test from "node:test";
import assert from "node:assert/strict";

import { withRelated } from "../app/lib/content/pipeline.mjs";

const YEAR = 365 * 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - YEAR).toISOString();
const future = new Date(Date.now() + YEAR).toISOString();

/** @param {object} over */
const post = (over) => ({
  slug: "x",
  title: "X",
  tags: ["cloudflare"],
  draft: false,
  publishAt: past,
  ...over,
});

const CORPUS = [
  post({ slug: "live-one", title: "Live one" }),
  post({ slug: "live-two", title: "Live two" }),
  post({ slug: "a-draft", title: "A draft", draft: true }),
  post({ slug: "scheduled", title: "Scheduled for next year", publishAt: future }),
];

/** The related slugs computed for one post in the corpus. */
const relatedFor = (slug) => {
  const out = withRelated(CORPUS).find((p) => p.slug === slug);
  return out.related.map((r) => r.slug);
};

test("CONTROL: a published post DOES get its published neighbour", () => {
  /*
   * Without this, every exclusion below could pass on a `withRelated` that
   * returned an empty list for everything, which is a broken feature rather
   * than a safe one.
   */
  assert.deepEqual(relatedFor("live-one"), ["live-two"]);
});

test("a draft is absent from a related list", () => {
  assert.ok(!relatedFor("live-one").includes("a-draft"));
});

test("A SCHEDULED POST IS ABSENT, which is the defect", () => {
  const related = relatedFor("live-one");
  assert.ok(
    !related.includes("scheduled"),
    `a post with publish_at in the future appeared in a public related list: ${related.join(", ")}`,
  );
});

test("a post that becomes visible in the past IS included", () => {
  // The other direction of the same rule: `publishAt` in the past is visible,
  // and a filter that excluded it would hide most of the site.
  const corpus = [
    post({ slug: "anchor" }),
    post({ slug: "just-live", publishAt: new Date(Date.now() - 1000).toISOString() }),
  ];
  const out = withRelated(corpus).find((p) => p.slug === "anchor");
  assert.deepEqual(out.related.map((r) => r.slug), ["just-live"]);
});

test("a post with NO publish date is treated as published, not as hidden", () => {
  /*
   * `publishAt` absent means "publish immediately", not "never". Reading a
   * missing date as a reason to exclude would hide every post that never set
   * one, which is the fail-closed direction being wrong.
   */
  const corpus = [post({ slug: "anchor" }), post({ slug: "dateless", publishAt: null })];
  const out = withRelated(corpus).find((p) => p.slug === "anchor");
  assert.deepEqual(out.related.map((r) => r.slug), ["dateless"]);
});
