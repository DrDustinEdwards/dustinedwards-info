/* An uploaded object's key SPELLS its dimensions (`<digest>-<width>x<height>.<ext>`), so a cover
 * gets its intrinsic size without a schema change (contentPicture). */

import test from "node:test";
import assert from "node:assert/strict";

import { contentPicture } from "../app/lib/media/images.mjs";

const SIZED_KEY = "/media/dustin-edwards-a1b2c3d4e5f60718-1600x900.webp";
/** A second one, deliberately a DIFFERENT shape, so a constant cannot pass. */
const OTHER_SIZED_KEY = "/media/dustin-edwards-00112233445566aa-800x1200.webp";

await test("a sized media key yields the shape the key spells, and the ladder", () => {
  const { img, sources } = contentPicture(SIZED_KEY, { alt: "", priority: true });
  /* Numbers, not strings: React drops an attribute it cannot render. */
  assert.equal(typeof img.width, "number");
  assert.equal(img.width / img.height, 1600 / 900);
  assert.ok(img.srcSet && sources.length > 0, "an uploaded cover gets a srcset and its formats");
  assert.equal(img.fetchPriority, "high");
  const other = contentPicture(OTHER_SIZED_KEY, { alt: "" }).img;
  assert.equal(other.width / other.height, 800 / 1200);
});

await test("anything whose path spells no size gets NOTHING, not a guess", () => {
  /* A wrong intrinsic size distorts the image, and a static file never passes through the transform route. The
   * grammar is anchored at both ends and admits no slash, so a traversal segment and an `og/` key read as no key. */
  for (const src of [
    "/media/dustin-edwards-a1b2c3d4e5f60718.svg",
    "/phage-hunters/dustin-edwards-2017.webp",
    "/media/og/a-post-ec381b0d.png",
    "/media/../secret-1600x900.webp",
  ]) {
    const { img, sources } = contentPicture(src, { alt: "" });
    assert.equal(img.width, undefined, src);
    assert.equal(img.srcSet, undefined, src);
    assert.equal(sources.length, 0, src);
  }
});
