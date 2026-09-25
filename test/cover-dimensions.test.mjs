/* An uploaded object's key SPELLS its dimensions (`<digest>-<width>x<height>.<ext>`), so a cover
 * gets its intrinsic size without a schema change. */

import test from "node:test";
import assert from "node:assert/strict";

import { coverDimensions, coverResponsive } from "../app/lib/cover-image.mjs";

const SIZED_KEY = "/media/dustin-edwards-a1b2c3d4e5f60718-1600x900.webp";
/** A second one, deliberately a DIFFERENT shape, so a constant cannot pass. */
const OTHER_SIZED_KEY = "/media/dustin-edwards-00112233445566aa-800x1200.webp";
const UNSIZED_KEY = "/media/dustin-edwards-a1b2c3d4e5f60718.svg";
const STATIC_SRC = "/phage-hunters/dustin-edwards-2017.webp";

test("a sized media key yields the pair the key spells, as NUMBERS", () => {
  /* Strict equality, so a string "1600" fails: React drops an attribute it cannot render. */
  assert.deepEqual(coverDimensions(SIZED_KEY), { width: 1600, height: 900 });
  assert.deepEqual(coverDimensions(OTHER_SIZED_KEY), { width: 800, height: 1200 });
});

test("a media key with no dimensions yields NOTHING, not a guess", () => {
  /* A wrong intrinsic size distorts the image, so no default is invented; `{}` spreads to no
   * attributes. */
  assert.deepEqual(coverDimensions(UNSIZED_KEY), {});
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
