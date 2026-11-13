import assert from "node:assert/strict";
import { test } from "node:test";

import { HOME_CARDS, picksFirst, splitFeatured, startHere } from "../app/lib/blog-listing.mjs";

const page = [
  { slug: "a", featured: false },
  { slug: "b", featured: true },
  { slug: "c", featured: false },
];

await test("the featured post is removed from the list it was found in", () => {
  const { featured, posts } = splitFeatured(page, true);
  assert.equal(featured?.slug, "b");
  assert.deepEqual(
    posts.map((p) => p.slug),
    ["a", "c"],
    "the hero post must not also appear as a row",
  );
});

await test("an ineligible page keeps its list intact and shows no hero", () => {
  const { featured, posts } = splitFeatured(page, false);
  assert.equal(featured, null);
  assert.deepEqual(
    posts.map((p) => p.slug),
    ["a", "b", "c"],
    "inside a filter the featured post is an ordinary row and must stay one",
  );
});

await test("no featured post on the page means no hero and no removal", () => {
  const plain = [
    { slug: "a", featured: false },
    { slug: "b", featured: false },
  ];
  const { featured, posts } = splitFeatured(plain, true);
  assert.equal(featured, null);
  assert.deepEqual(
    posts.map((p) => p.slug),
    ["a", "b"],
  );
});

await test("the first featured post wins when the data carries more than one", () => {
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

const flagship = { slug: "flagship" };
const others = [{ slug: "n1" }, { slug: "n2" }, { slug: "n3" }, { slug: "n4" }, { slug: "n5" }];

await test("the featured post leads and the others fill in behind it", () => {
  const { featured, recent } = startHere([flagship], others);
  assert.equal(featured.slug, "flagship");
  assert.deepEqual(
    recent.map((p) => p.slug),
    ["n1", "n2"],
    "three rows in total (the home page's best-of, 2026-09-27), so two follow the lead",
  );
});

await test("with nothing featured the first of the others leads and the section still shows three", () => {
  const { featured, recent } = startHere([], others);
  assert.equal(featured.slug, "n1", "the newest leads");
  assert.deepEqual(
    recent.map((p) => p.slug),
    ["n2", "n3"],
    "three rows, not two: the section must not shrink because nothing is featured",
  );
  assert.equal(HOME_CARDS, 3);
});

await test("the home page's picks come first, in pick order, then the rest newest first", () => {
  const rows = [{ slug: "n1" }, { slug: "p2" }, { slug: "n2" }, { slug: "p1" }];
  assert.deepEqual(
    picksFirst(rows, ["p1", "p2"]).map((p) => p.slug),
    ["p1", "p2", "n1", "n2"],
  );
});

await test("a pick that is not published drops out and the newest fill its place", () => {
  assert.deepEqual(
    picksFirst([{ slug: "n1" }, { slug: "p2" }, { slug: "n2" }], ["gone", "p2"]).map((p) => p.slug),
    ["p2", "n1", "n2"],
  );
});

await test("a post in both queries appears once", () => {
  assert.deepEqual(
    picksFirst([{ slug: "p1" }, { slug: "n1" }, { slug: "p1" }], ["p1"]).map((p) => p.slug),
    ["p1", "n1"],
    "listHomeStartHere merges the picks query with the newest query, which can overlap",
  );
});

await test("an empty corpus yields a null lead, which renders the section dark", () => {
  const { featured, recent } = startHere([], []);
  assert.equal(featured, null, "home guards on {featured ? ... : null}");
  assert.deepEqual(recent, []);
});
