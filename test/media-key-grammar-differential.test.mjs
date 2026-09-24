/**
 * What `dimensionsFromKey` measures from a key, and which extensions
 * `classify()` accepts.
 *
 * The strictness matters because a null is a build failure at the call site: a
 * key the delete and set-alt guards refuse must not be one the resolver
 * measures. A loose width like `-0800x600` once read as 800 by 600 while the
 * other two readers called the same key not-a-content-key.
 *
 * @see app/lib/media/classify.mjs, CONTENT_KEY_SHAPE
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  classify,
  contentKey,
  digestFromKey,
  dimensionsFromKey,
  isContentKey,
} from "../app/lib/media/classify.mjs";

/** A fixed 32-byte digest, the same one the reader sweep uses. */
const DIGEST = Uint8Array.from({ length: 32 }, (_, i) => i).buffer;
const HEX16 = "0001020304050607";
const P = "dustin-edwards-";

test("classify() accepts every served extension and refuses executable ones", () => {
  const accepted = [
    "png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "ico",
    "pdf", "webmanifest", "txt",
  ];
  for (const extension of accepted) {
    assert.equal(classify(`/media/${P}${HEX16}.${extension}`).extension, extension);
  }
  for (const extension of ["exe", "html"]) {
    assert.throws(() => classify(`/media/${P}${HEX16}.${extension}`), /unclassified asset/);
  }
});

const RASTER_KEY = contentKey(DIGEST, "webp", { width: 1600, height: 900 });

/** Key or path in, the dimensions a resolver would render, or null for "cannot tell". */
const DIMENSION_CASES = [
  [RASTER_KEY, { width: 1600, height: 900 }],
  [`/media/${RASTER_KEY}`, { width: 1600, height: 900 }],
  [`/media/${RASTER_KEY}?w=320`, { width: 1600, height: 900 }],
  [`${P}${HEX16}-1600x900.webp?w=1024#frag`, { width: 1600, height: 900 }],
  [contentKey(DIGEST, "png", { width: 1, height: 1 }), { width: 1, height: 1 }],
  [contentKey(DIGEST, "avif", { width: 99999, height: 99999 }), { width: 99999, height: 99999 }],
  [contentKey(DIGEST, "webp", { width: 1600, height: 900 }, "Cohort Photo.WEBP"), { width: 1600, height: 900 }],
  [contentKey(DIGEST, "svg", null), null],
  [`og/${RASTER_KEY}`, null],
  [`../${RASTER_KEY}`, null],
  ["og/some-post-65777080.png", null],
  ["/publications/paper.pdf", null],
  ["", null],
  [`${P}${HEX16}`, null],
  [`${P}${HEX16}-0800x600.webp`, null],
  [`${P}${HEX16}-800x0600.webp`, null],
  [`${P}${HEX16}-0x0.webp`, null],
  [`${P}${HEX16}-000000x1.webp`, null],
  [`${P}${HEX16}-100000x1.webp`, null],
  [`${P}${HEX16}-1600x900.WEBP`, null],
  [`${P}${HEX16}-1600x900`, null],
  [`${P}0001020304abcdef-1600x900.webp`, { width: 1600, height: 900 }],
  [`${P}0001020304ABCDEF-1600x900.webp`, null],
  ["photo-800x600.webp", null],
  // Unprefixed keys predate the prefix; an object still under this name is unmigrated.
  [`${HEX16}-1600x900.webp`, null],
];

test("dimensionsFromKey measures exactly the keys the writer emits", () => {
  for (const [input, expected] of DIMENSION_CASES) {
    assert.deepEqual(dimensionsFromKey(input), expected, JSON.stringify(input));
  }
});

test("on the two inputs that differ, all three readers now give one answer", () => {
  // Before the grammar had one spelling, each of these keys got three answers.
  for (const key of [`${P}${HEX16}-0800x600.webp`, `${P}${HEX16}-800x0600.webp`]) {
    assert.equal(isContentKey(key), false, `isContentKey(${key})`);
    assert.equal(digestFromKey(key), null, `digestFromKey(${key})`);
    assert.equal(dimensionsFromKey(key), null, `dimensionsFromKey(${key})`);
  }
});
