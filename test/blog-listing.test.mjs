import assert from "node:assert/strict";
import { test } from "node:test";

import { splitFeatured, startHere } from "../app/lib/blog-listing.mjs";

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

const flagship = { slug: "flagship" };
const others = [{ slug: "n1" }, { slug: "n2" }, { slug: "n3" }, { slug: "n4" }, { slug: "n5" }];

test("the featured post leads and the others fill in behind it", () => {
  const { featured, recent } = startHere([flagship], others);
  assert.equal(featured.slug, "flagship");
  assert.deepEqual(
    recent.map((p) => p.slug),
    ["n1", "n2", "n3", "n4"],
    "five rows in total (02-home.html §4), so four follow the lead",
  );
});

test("the featured post is never also one of the others", () => {
  const { featured, recent } = startHere([flagship], others);
  assert.ok(
    !recent.some((p) => p.slug === featured.slug),
    "the caller queries others as featured = 0, and printing the lead twice is the " +
      "defect splitFeatured exists to prevent on /blog",
  );
});

test("with nothing featured the newest leads and the section still shows five", () => {
  const { featured, recent } = startHere([], others);
  assert.equal(featured.slug, "n1", "ruling 57: the newest leads");
  assert.deepEqual(
    recent.map((p) => p.slug),
    ["n2", "n3", "n4", "n5"],
    "five rows, not four: the section must not shrink because nothing is featured",
  );
});

test("an empty corpus yields a null lead, which renders the section dark", () => {
  const { featured, recent } = startHere([], []);
  assert.equal(featured, null, "home guards on {featured ? ... : null}");
  assert.deepEqual(recent, []);
});

test("a short corpus returns what it has rather than padding", () => {
  const { featured, recent } = startHere([], [{ slug: "only" }]);
  assert.equal(featured.slug, "only");
  assert.deepEqual(recent, [], "one post is one card, not one card and three holes");
});

test("cards is honored, so the count has one owner", () => {
  const { recent } = startHere([flagship], others, 2);
  assert.deepEqual(
    recent.map((p) => p.slug),
    ["n1"],
    "HOME_CARDS is the default and the section's size is not written twice",
  );
});
