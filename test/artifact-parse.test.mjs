/**
 * Reading the committed artifact, and refusing rather than inventing a corpus.
 *
 * REPLAYS THE FINDING, per hard rule 12. Write-quality audit finding 14: "no
 * file returns `[] as any[]`; `.posts ?? [] as any[]`. Invalid JSON throws." and
 * "A missing posts.json looks like 'zero posts,' not a failed load." Verified at
 * HEAD before the fix, at publish.server.ts:302.
 *
 * The consequence that makes this worth a throw is downstream: savePost rebuilds
 * the WHOLE artifact from what loadArtifact returned, so a save against a
 * phantom empty corpus commits an artifact holding one post and drops every
 * other post from the repository.
 *
 * @see app/lib/editor/artifact-parse.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { artifactPosts } from "../app/lib/editor/artifact-parse.mjs";

const PATH = "content/generated/posts.json";
const boom = (m) => Object.assign(new Error(m), { name: "EditorError" });

const file = (value) => ({ content: JSON.stringify(value) });

/* ------------------------------------------------------- the loading path */

test("a valid artifact returns its posts", () => {
  const posts = [{ slug: "a" }, { slug: "b" }];
  assert.deepEqual(artifactPosts(file({ posts }), PATH, boom), posts);
});

test("an EMPTY posts array is a real corpus with no posts, and loads", () => {
  // The distinction `?? []` could not make: this is legitimately empty.
  assert.deepEqual(artifactPosts(file({ posts: [] }), PATH, boom), []);
});

/* ------------------------------------------------------ the refusing path */

test("A MISSING ARTIFACT THROWS rather than reading as an empty corpus", () => {
  for (const missing of [null, undefined]) {
    assert.throws(
      () => artifactPosts(missing, PATH, boom),
      (error) => {
        assert.equal(error.name, "EditorError", "must use the caller's error type");
        assert.match(error.message, /is missing from the repository/);
        assert.match(error.message, /not an empty corpus/, "must say what it is not");
        assert.match(
          error.message,
          /drop every other post/,
          "must name the consequence, because 'missing' does not convey it",
        );
        assert.match(error.message, /build:content/, "and the repair");
        return true;
      },
    );
  }
});

test("invalid JSON still throws, which was already right", () => {
  assert.throws(
    () => artifactPosts({ content: "{ not json" }, PATH, boom),
    /is not valid JSON/,
  );
});

test("an artifact with NO posts key is malformed and throws", () => {
  // `{}` and `{"posts": null}` both read as an empty corpus under `?? []`.
  for (const value of [{}, { posts: null }, { posts: "twelve" }, { posts: 12 }]) {
    assert.throws(
      () => artifactPosts(file(value), PATH, boom),
      (error) => {
        assert.match(error.message, /carries no posts array/);
        assert.match(error.message, /those are different/, "must draw the distinction");
        return true;
      },
      `${JSON.stringify(value)} must not read as an empty corpus`,
    );
  }
});

test("the default error type is a plain Error, so the module needs no caller", () => {
  // The pure module must not depend on the editor's error class to be usable.
  assert.throws(() => artifactPosts(null, PATH), /is missing from the repository/);
});
