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
 *
 * Written as ` ` in the source rather than the literal byte. The literal made
 * `app/db/index.ts` binary to git and to ripgrep from 2026-08-02 to 2026-08-09:
 * diffs rendered as `Bin n -> m` and a directory-scoped search skipped the whole
 * database layer. The gates were never affected, because they read with Node.
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

/*
 * THE DEFECT THIS CAUGHT, 2026-08-25, kept as a test because it was real.
 *
 * `mediaRefStatements` in app/lib/editor/publish.server.ts is the LIVE writer,
 * and it deduplicated on a SPACE join while this NUL-joined helper, with its
 * argument and its tests, was reachable only from `replaceMediaRefsForSource`,
 * which had no caller at all and has since been deleted. The rule was written down and attached to nothing
 * that ran.
 *
 * WHAT THIS TEST DOES NOT COVER, stated rather than implied: it models the
 * writer's dedup LOOP, it does not call it. `mediaRefStatements` needs a live
 * D1 binding and sits in a `.ts` module behind `~/` imports, so it is
 * unreachable from `node:test` for exactly the reason stated at the top of this
 * file. What is asserted here is the property the loop depends on, over the
 * values the pipeline really emits.
 */
test("THE LIVE WRITER'S LOOP: a space join drops a real ref, NUL keeps both", () => {
  // Both plausible from the pipeline, which emits details like "cover image".
  const a = ref("og/cover-1.png", "inline", "line 3 alt");
  const b = ref("og/cover-1.png", "inline line", "3 alt");

  const spaceJoin = (r) => `${r.mediaKey} ${r.form} ${r.detail ?? ""}`;
  assert.equal(
    spaceJoin(a),
    spaceJoin(b),
    "if these no longer collide under a space the example is stale, not the rule",
  );

  // The loop, as the writer runs it: a Set of keys, one row per survivor.
  const survivors = (key) => {
    const seen = new Set();
    const rows = [];
    for (const r of [a, b]) {
      const id = key(r);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(r);
    }
    return rows;
  };

  assert.equal(survivors(spaceJoin).length, 1, "the defect: one of two refs is dropped");
  assert.equal(
    survivors(mediaRefKey).length,
    2,
    "both rows must survive; a post citing two images must record two",
  );
});

test("the separator is NUL, which cannot occur in any component", () => {
  const key = mediaRefKey(ref("og/x-1.png", "cover", "line-3"));
  assert.equal(key, `og/x-1.png${NUL}cover${NUL}line-3`);
  assert.equal(key.split(NUL).length, 3, "the key must have exactly three parts");
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

test("the source carries no literal NUL byte", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("app/lib/media-ref-key.mjs", "utf8") + readFileSync("app/db/index.ts", "utf8");
  assert.ok(
    !source.includes(NUL),
    "a literal NUL makes this file binary to git and to ripgrep. Use the escape.",
  );
});
