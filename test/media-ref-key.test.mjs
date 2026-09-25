/* Under a printable separator, ("a|b", "c") and ("a", "b|c") collide and one ref is silently
 * dropped. NUL cannot occur in a media key, a form or a detail. */

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

