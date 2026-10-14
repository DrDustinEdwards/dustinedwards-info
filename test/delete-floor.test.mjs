/**
 * The floors in front of sync:content, build:diagrams and build:og. Each converges a store toward the
 * content artifact, so an empty or reshaped artifact used to converge production to nothing and then
 * verify the nothing against itself.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteFloor,
  requirePosts,
  syncablePostProblems,
} from "../scripts/lib/delete-floor.mjs";

const POST = {
  slug: "a-post",
  sourcePath: "content/posts/a-post.md",
  tags: ["virology"],
  mediaRefs: [],
  sourceBlobSha: "abc123",
  renderHash: "def456",
};

await test("REPLAY: an artifact with posts: [] is refused before anything is deleted", () => {
  assert.throws(() => requirePosts({ posts: [], records: [] }, "posts.json"), /zero posts/);
});

await test("an artifact with no posts key, or not an object at all, is refused", () => {
  for (const bad of [{}, { posts: null }, { posts: "x" }, null, [], "posts"]) {
    assert.throws(() => requirePosts(bad, "posts.json"), /posts\.json/, JSON.stringify(bad));
  }
});

await test("a whole artifact hands back its posts", () => {
  assert.deepEqual(requirePosts({ posts: [POST] }, "posts.json"), [POST]);
});

await test("a delete that keeps nothing is refused", () => {
  assert.match(
    deleteFloor({ what: "file-sourced posts", keeping: 0, removing: 15 }) ?? "",
    /delete all 15/,
  );
});

await test("a delete that removes more than it keeps is refused", () => {
  assert.match(
    deleteFloor({ what: "search records", keeping: 90, removing: 110 }) ?? "",
    /delete 110 search records and keep only 90/,
  );
});

await test("removing one post, or none, goes ahead", () => {
  assert.equal(deleteFloor({ what: "posts", keeping: 14, removing: 1 }), null);
  assert.equal(deleteFloor({ what: "posts", keeping: 15, removing: 0 }), null);
  // An empty store with nothing to delete is a fresh local database, not a collapse.
  assert.equal(deleteFloor({ what: "posts", keeping: 0, removing: 0 }), null);
  // Exactly half is the boundary and still goes ahead.
  assert.equal(deleteFloor({ what: "posts", keeping: 5, removing: 5 }), null);
});

await test("an unreadable count refuses rather than passing", () => {
  for (const bad of [undefined, null, Number.NaN, "3", 1.5, -1]) {
    assert.match(
      deleteFloor({ what: "posts", keeping: 10, removing: /** @type {any} */ (bad) }) ?? "",
      /unreadable/,
      `removing=${String(bad)}`,
    );
    assert.match(
      deleteFloor({ what: "posts", keeping: /** @type {any} */ (bad), removing: 0 }) ?? "",
      /unreadable/,
      `keeping=${String(bad)}`,
    );
  }
});

await test("a whole post has no sync problems", () => {
  assert.deepEqual(syncablePostProblems([POST]), []);
});

await test("REPLAY: a post without mediaRefs is refused, since media_refs is replaced wholesale", () => {
  const { mediaRefs: _, ...noRefs } = POST;
  assert.deepEqual(syncablePostProblems([noRefs]), ["a-post: mediaRefs is not an array"]);
});

await test("missing hashes are refused, since they disable drift detection", () => {
  const problems = syncablePostProblems([{ ...POST, sourceBlobSha: null, renderHash: "" }]);
  assert.deepEqual(problems, ["a-post: no sourceBlobSha", "a-post: no renderHash"]);
});

await test("a post without a slug or source path is named by its index", () => {
  const problems = syncablePostProblems([POST, { ...POST, slug: undefined, sourcePath: null }]);
  assert.deepEqual(problems, ["posts[1]: no slug", "posts[1]: no sourcePath"]);
});
