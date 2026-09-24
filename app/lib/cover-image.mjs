import { dimensionsFromKey } from "./media/classify.mjs";
import { CONTENT_SIZES, contentSrcSet } from "./media/widths.mjs";

/**
 * Uses the body images' ladder, since a width the page advertises and the transform route refuses
 * is a broken image. A static `public/` cover has only one size, so it gets a plain `src`.
 *
 * @param {string} src
 * @returns {{ srcSet?: string, sizes?: string }}
 */
export function coverResponsive(src) {
  if (!src.startsWith("/media/")) return {};
  return { srcSet: contentSrcSet(src.slice("/media/".length)), sizes: CONTENT_SIZES };
}

/**
 * An uploaded key encodes its own dimensions, so no schema change is needed. A static cover has no
 * key and returns `{}`: an invented size would distort the image, which is worse than no size.
 *
 * @param {string} src
 * @returns {{ width?: number, height?: number }}
 */
export function coverDimensions(src) {
  const dimensions = dimensionsFromKey(src);
  return dimensions ? { width: dimensions.width, height: dimensions.height } : {};
}
