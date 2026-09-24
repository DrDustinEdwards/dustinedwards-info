/* A SCHEDULED post is not a draft, so `!draft` alone admits it. The list is stored at write
 * time; `blog.$slug.tsx` re-checks it at read time, which `check:browser` covers. */

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

const relatedFor = (slug) => {
  const out = withRelated(CORPUS).find((p) => p.slug === slug);
  return out.related.map((r) => r.slug);
};

test("CONTROL: a published post DOES get its published neighbor", () => {
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
  /* `publishAt` absent means "publish immediately", not "never": excluding it would hide every
   * post that never set one. */
  const corpus = [post({ slug: "anchor" }), post({ slug: "dateless", publishAt: null })];
  const out = withRelated(corpus).find((p) => p.slug === "anchor");
  assert.deepEqual(out.related.map((r) => r.slug), ["dateless"]);
});
