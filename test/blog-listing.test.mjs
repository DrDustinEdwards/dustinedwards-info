import assert from "node:assert/strict";
import { test } from "node:test";

import { splitFeatured } from "../app/lib/blog-listing.mjs";

/*
 * The defect this covers was LATENT, which is why it is tested rather than
 * looked at: 0 of 12 posts carry `featured: true`, so /blog has never actually
 * rendered the duplicate. A rendered page would have shown nothing either way.
 */

const page = [
  { slug: "a", featured: false },
  { slug: "b", featured: true },
  { slug: "c", featured: false },
];

test("the featured post is removed from the list it was found in", () => {
  const { featured, posts } = splitFeatured(page, true);
  assert.equal(featured?.slug, "b");
  assert.deepEqual(
    posts.map((p) => p.slug),
    ["a", "c"],
    "the hero post must not also appear as a row",
  );
});

test("every post is still accounted for exactly once", () => {
  const { featured, posts } = splitFeatured(page, true);
  const shown = [featured, ...posts].filter(Boolean).map((p) => p.slug).sort();
  assert.deepEqual(shown, ["a", "b", "c"], "removing it must not lose it");
});

test("order is preserved for the posts that remain", () => {
  const { posts } = splitFeatured(
    [
      { slug: "x", featured: true },
      { slug: "y", featured: false },
      { slug: "z", featured: false },
    ],
    true,
  );
  assert.deepEqual(posts.map((p) => p.slug), ["y", "z"]);
});

test("an ineligible page keeps its list intact and shows no hero", () => {
  const { featured, posts } = splitFeatured(page, false);
  assert.equal(featured, null);
  assert.deepEqual(
    posts.map((p) => p.slug),
    ["a", "b", "c"],
    "inside a filter the featured post is an ordinary row and must stay one",
  );
});

test("no featured post on the page means no hero and no removal", () => {
  const plain = [
    { slug: "a", featured: false },
    { slug: "b", featured: false },
  ];
  const { featured, posts } = splitFeatured(plain, true);
  assert.equal(featured, null);
  assert.deepEqual(posts.map((p) => p.slug), ["a", "b"]);
});

test("the first featured post wins when the data carries more than one", () => {
  const two = [
    { slug: "a", featured: true },
    { slug: "b", featured: true },
  ];
  const { featured, posts } = splitFeatured(two, true);
  assert.equal(featured?.slug, "a");
  assert.deepEqual(
    posts.map((p) => p.slug),
    ["b"],
    "only the one actually shown as the hero is removed; the other stays a row",
  );
});

test("the input array is not mutated", () => {
  const input = [...page];
  splitFeatured(input, true);
  assert.deepEqual(
    input.map((p) => p.slug),
    ["a", "b", "c"],
    "the loader spreads this array elsewhere; mutating it would act at a distance",
  );
});
