import test from "node:test";
import assert from "node:assert/strict";

import { newestFirst } from "../app/lib/post-order.mjs";

const at = "2026-10-04T00:00:00.000Z";
const post = (slug, extra = {}) => ({ slug, publishAt: at, series: null, part: null, ...extra });
const order = (posts) => newestFirst(posts, (p) => p.slug).map((p) => p.slug);

test("posts sharing an instant and a series come latest part first", () => {
  const posts = [post("a", { series: "S", part: 1 }), post("b", { series: "S", part: 3 }), post("c", { series: "S", part: 2 })];
  assert.deepEqual(order(posts), ["b", "c", "a"]);
});

test("a later instant still leads, whatever the parts", () => {
  const posts = [post("old3", { series: "S", part: 3 }), post("new1", { series: "S", part: 1, publishAt: "2026-10-05T00:00:00.000Z" })];
  assert.deepEqual(order(posts), ["new1", "old3"]);
});

test("posts with no series, or in different series, keep the tie-break (the later row first)", () => {
  assert.deepEqual(order([post("a"), post("c"), post("b")]), ["c", "b", "a"]);
  const mixed = [post("a", { series: "X", part: 9 }), post("b", { series: "Y", part: 1 })];
  assert.deepEqual(order(mixed), ["b", "a"]);
});

test("a series keeps together and in part order beside unrelated posts of the same instant, in any input order", () => {
  const posts = [post("s1", { series: "S", part: 1 }), post("m"), post("s2", { series: "S", part: 2 }), post("z"), post("a")];
  const expected = order(posts);
  assert.deepEqual(expected, ["z", "s2", "s1", "m", "a"]);
  for (const shuffled of [[...posts].reverse(), [posts[2], posts[4], posts[0], posts[3], posts[1]]]) assert.deepEqual(order(shuffled), expected);
});
