/**
 * `mediaRefKey()` and the collision the NUL separator prevents.
 *
 * WHAT THIS PROTECTS. `mediaRefStatements` deduplicates refs before a
 * batch insert, because the primary key is
 * (media_key, source_type, source_id, form, detail) and inserting the same
 * tuple twice fails the whole batch rather than merging. The dedup key is a
 * three-part join, and the separator choice is the entire correctness argument.
 *
 * Under a printable separator such as `|`, the refs ("a|b", "c") and
 * ("a", "b|c") produce the SAME key. The second would be dropped as a
 * duplicate, so a post citing two different images would silently record one.
 * NUL cannot occur in a media key, a form or a detail, so the join is
 * unambiguous.
 *
 * WHY THE FUNCTION IS EXPORTED. `mediaRefStatements` needs a live D1 binding,
 * so this property is unreachable through it in a unit test. The key builder
 * is exported for that reason and for no other, which is stated at its
 * definition so nobody wires it into a second caller.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { mediaRefKey } from "../app/lib/media-ref-key.mjs";

const NUL = String.fromCharCode(0);

/** @param {string} mediaKey @param {string} form @param {string | null} detail */
const ref = (mediaKey, form, detail = null) => ({ mediaKey, form, detail });

test("THE COLLISION: a printable separator would merge two distinct refs", () => {
  const a = mediaRefKey(ref("a|b", "c"));
  const b = mediaRefKey(ref("a", "b|c"));
  assert.notEqual(
    a,
    b,
    "these two refs produced the same key, so one would be dropped before insert",
  );

  // And the reason, stated so the test explains itself when it fails: under a
  // pipe they genuinely are identical, which is why the separator is not one.
  const pipe = (r) => `${r.mediaKey}|${r.form}|${r.detail ?? ""}`;
  assert.equal(
    pipe(ref("a|b", "c")),
    pipe(ref("a", "b|c")),
    "if this no longer collides the example is stale, not the rule",
  );
});

test("a null detail is an empty part, not a missing one", () => {
  assert.equal(mediaRefKey(ref("m", "f", null)), `m${NUL}f${NUL}`);
  assert.equal(
    mediaRefKey(ref("m", "f", null)),
    mediaRefKey(ref("m", "f", "")),
    "null and empty string are the same ref and must dedup together",
  );
});

test("identical refs produce identical keys, so dedup actually dedups", () => {
  assert.equal(mediaRefKey(ref("m", "f", "d")), mediaRefKey(ref("m", "f", "d")));
});

test("a difference in ANY component produces a different key", () => {
  const base = mediaRefKey(ref("m", "f", "d"));
  assert.notEqual(base, mediaRefKey(ref("M", "f", "d")));
  assert.notEqual(base, mediaRefKey(ref("m", "F", "d")));
  assert.notEqual(base, mediaRefKey(ref("m", "f", "D")));
});

