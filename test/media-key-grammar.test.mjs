/**
 * The media key grammar has ONE owner, and these are the assertions that fail
 * when a second one appears.
 *
 * WHAT THIS PROTECTS. `contentKey` in classify.mjs writes two shapes,
 * `<16 hex>.<ext>` and `<16 hex>-<w>x<h>.<ext>`, and three readers used to
 * carry their own regex over them: `isManagedKey` in core.server.ts, `hashOf`
 * in mediaTwins, and the inspector hash in the media route. All three predated
 * the dimension segment, so every uploaded raster was refused by delete,
 * set-alt and empty-trash, hashed to null in the inspector, and was invisible
 * to twin detection. Latent only because R2 held no uploaded originals yet.
 *
 * TWO HALVES. The behavioral half feeds real `contentKey` output to the two
 * readers that now own the grammar. The source half asserts the three former
 * copies STAYED deleted, because a reader that regrows a private regex fails
 * exactly when the writer moves, which no behavioral test of the reader's
 * module can see (core.server.ts imports `~/db` and cannot be loaded here).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contentKey,
  digestFromKey,
  isContentKey,
} from "../app/lib/media/classify.mjs";
import { stripComments } from "../scripts/lib/strip-comments.mjs";

/** A fixed 32-byte digest: 00 01 02 ... 1f. First 16 hex: 0001020304050607. */
const DIGEST = Uint8Array.from({ length: 32 }, (_, i) => i).buffer;
const HEX16 = "0001020304050607";

const RASTER_KEY = contentKey(DIGEST, "webp", { width: 1600, height: 900 });
const SVG_KEY = contentKey(DIGEST, "svg", null);
const NAMED_KEY = contentKey(DIGEST, "webp", { width: 1600, height: 900 }, "Cohort Photo.WEBP");

test("contentKey emits the two documented shapes from the fixed digest", () => {
  // Pinned literally, so a change to the writer's output fails HERE, naming
  // the new shape, rather than surfacing as a mystery in the table below.
  assert.equal(RASTER_KEY, `dustin-edwards-${HEX16}-1600x900.webp`);
  assert.equal(SVG_KEY, `dustin-edwards-${HEX16}.svg`);
});

test("an upload's filename becomes the descriptive segment, and the prefix is never doubled", () => {
  assert.equal(NAMED_KEY, `dustin-edwards-cohort-photo-${HEX16}-1600x900.webp`);
  assert.equal(
    contentKey(DIGEST, "webp", null, "dustin-edwards-2017.webp"),
    `dustin-edwards-2017-${HEX16}.webp`,
  );
  // Nothing usable in the name leaves the prefix and the digest, never a stray hyphen.
  assert.equal(contentKey(DIGEST, "svg", null, "..."), `dustin-edwards-${HEX16}.svg`);
});

/**
 * Every case the grammar's two readers are asserted over. One table, one loop,
 * and a count assertion at the end, so the suite cannot pass by iterating
 * nothing.
 *
 * `isContent` is what isContentKey must say for the KEY FORM; `digest` is what
 * digestFromKey must return for the same string. The /media/ path rows exist
 * because digestFromKey accepts both forms while isContentKey deliberately
 * takes bare keys only.
 */
const CASES = [
  { name: "raster key with dimensions", input: RASTER_KEY, isContent: true, digest: HEX16 },
  { name: "svg key without dimensions", input: SVG_KEY, isContent: true, digest: HEX16 },
  { name: "raster key as /media/ path", input: `/media/${RASTER_KEY}`, isContent: false, digest: HEX16 },
  { name: "svg key as /media/ path", input: `/media/${SVG_KEY}`, isContent: false, digest: HEX16 },
  { name: "raster path with transform query", input: `/media/${RASTER_KEY}?w=320`, isContent: false, digest: HEX16 },
  { name: "og/ derived key", input: `og/some-post-65777080.png`, isContent: false, digest: null },
  { name: "og/ prefix on a real key", input: `og/${RASTER_KEY}`, isContent: false, digest: null },
  { name: "static asset path", input: "/publications/paper.pdf", isContent: false, digest: null },
  { name: "traversal segment", input: `../${SVG_KEY}`, isContent: false, digest: null },
  { name: "bare hex with no extension", input: HEX16, isContent: false, digest: null },
  { name: "named key with a slug", input: NAMED_KEY, isContent: true, digest: HEX16 },
  { name: "slug ending in hex, digest is the LAST run", input: `dustin-edwards-a-ffffffffffffffff-${HEX16}.png`, isContent: true, digest: HEX16 },
  { name: "pre-127 unprefixed key", input: `${HEX16}-1600x900.webp`, isContent: false, digest: null },
];

test("isContentKey and digestFromKey agree with the writer on every case", () => {
  let checked = 0;
  for (const c of CASES) {
    assert.equal(isContentKey(c.input), c.isContent, `isContentKey(${c.name})`);
    assert.equal(digestFromKey(c.input), c.digest, `digestFromKey(${c.name})`);
    checked += 1;
  }
  // The count is the literal table length, restated so a truncated table (or a
  // loop that stopped early) is a failure rather than a smaller clean run.
  assert.equal(checked, 13, "every case in the table was checked");
});

/**
 * THE SWEEP, MADE DURABLE. The three files that carried private copies of the
 * grammar must not contain one again. Matched on the un-escapable stem of any
 * such regex, as a literal string, after comment stripping, because a comment
 * explaining the ban would otherwise satisfy the search for a violation.
 */
const FORMER_COPIES = [
  { file: "app/lib/media/core.server.ts", anchor: "isManagedKey" },
  { file: "app/db/index.ts", anchor: "mediaTwins" },
  { file: "app/routes/admin.media._index.tsx", anchor: "digestFromKey" },
];

test("no former grammar copy has regrown its own 16-hex regex", () => {
  let checked = 0;
  for (const { file, anchor } of FORMER_COPIES) {
    const source = stripComments(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    // Scope, proven non-empty: the file read something and it is the file this
    // test believes it is. Without this, a moved file passes vacuously.
    assert.ok(source.length > 0, `${file} read empty`);
    assert.ok(source.includes(anchor), `${file} no longer contains "${anchor}"; the sweep is aimed at the wrong file`);
    assert.ok(
      !source.includes("[0-9a-f]{16"),
      `${file} carries its own 16-hex key regex again; the grammar's only owner is classify.mjs (isContentKey / digestFromKey)`,
    );
    checked += 1;
  }
  assert.equal(checked, 3, "all three former copies were swept");
});
