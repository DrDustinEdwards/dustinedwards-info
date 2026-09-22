/**
 * A post cover carries `width` and `height`, and they come out of the key.
 *
 * ## The defect this replays
 *
 * Measured in the pre-cutover audit, 2026-09-11 (P1-16): the cover `<img>` in
 * `app/routes/blog.$slug.tsx` carried `src`, `alt`, `loading`, `fetchPriority`,
 * `decoding`, `srcset` and `sizes`, and no intrinsic size at all. It is the
 * first image on the page and, when present, the LCP element, so it is the one
 * image on the site where a missing intrinsic size costs the most.
 *
 * The comment beside it said this could not be fixed without a schema change,
 * because D1 stores `cover_image` and `cover_alt` and no dimensions. That
 * premise was true and the conclusion was wrong: an uploaded object's key
 * SPELLS its dimensions, `<digest>-<width>x<height>.<ext>`, and the prose
 * pipeline had been reading them back that way for every body image since it
 * was written.
 *
 * ## What each case can fail on
 *
 * BOTH DIRECTIONS, because a function that answered `{width: 1600, height: 900}`
 * for everything would satisfy a one-sided test and would put a wrong intrinsic
 * size on every static cover, which distorts the image rather than merely
 * failing to reserve space for it.
 *
 * THE NUMBERS COME FROM THE KEY UNDER TEST, not from a constant this file and
 * the implementation could both be wrong about: each case asserts the pair the
 * key literally spells, and the two keys spell DIFFERENT pairs, so an
 * implementation returning a fixed answer fails at least one of them.
 *
 * `coverResponsive` rides along because it moved out of the route in the same
 * commit and had never been reachable by a test either.
 *
 * @see app/lib/cover-image.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { coverDimensions, coverResponsive } from "../app/lib/cover-image.mjs";

/** An uploaded object. The key is the whole subject: it spells 1600 by 900. */
const SIZED_KEY = "/media/dustin-edwards-a1b2c3d4e5f60718-1600x900.webp";
/** A second one, deliberately a DIFFERENT shape, so a constant cannot pass. */
const OTHER_SIZED_KEY = "/media/dustin-edwards-00112233445566aa-800x1200.webp";
/** An uploaded object whose key carries no dimensions: an SVG has none. */
const UNSIZED_KEY = "/media/dustin-edwards-a1b2c3d4e5f60718.svg";
/** A file under `public/`, served as itself. There is no key to read. */
const STATIC_SRC = "/phage-hunters/dustin-edwards-2017.webp";

test("a sized media key yields the pair the key spells", () => {
  assert.deepEqual(coverDimensions(SIZED_KEY), { width: 1600, height: 900 });
  assert.deepEqual(coverDimensions(OTHER_SIZED_KEY), { width: 800, height: 1200 });
});

test("the values are NUMBERS, because React drops an attribute it cannot render", () => {
  const { width, height } = coverDimensions(SIZED_KEY);
  assert.equal(typeof width, "number");
  assert.equal(typeof height, "number");
});

test("a media key with no dimensions yields NOTHING, not a guess", () => {
  /*
   * Hard rule 13: a fallback that SUBSTITUTES a different value is not failing
   * closed. An invented default here would be worse than the gap, because a
   * wrong intrinsic size distorts the image. `{}` spreads to no attributes.
   */
  assert.deepEqual(coverDimensions(UNSIZED_KEY), {});
  assert.equal(Object.keys(coverDimensions(UNSIZED_KEY)).length, 0);
});

test("a static cover yields nothing, because its path carries no key", () => {
  assert.deepEqual(coverDimensions(STATIC_SRC), {});
});

test("a path that merely looks like a key is not read as one", () => {
  /* The grammar is anchored at both ends and admits no slash, which is what
   * keeps a traversal segment and an `og/` key from resolving to dimensions. */
  assert.deepEqual(coverDimensions("/media/og/a-post-ec381b0d.png"), {});
  assert.deepEqual(coverDimensions("/media/../secret-1600x900.webp"), {});
});

test("coverResponsive offers the ladder only for objects the route can serve", () => {
  const responsive = coverResponsive(SIZED_KEY);
  assert.ok(responsive.srcSet, "an uploaded cover gets a srcset");
  assert.ok(responsive.sizes, "and the sizes that choose from it");

  /* A static asset never passes through the transform route, so advertising
   * widths for one would offer URLs that 404. */
  assert.deepEqual(coverResponsive(STATIC_SRC), {});
});
