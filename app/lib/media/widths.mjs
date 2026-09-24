// Both sets are CLOSED: the Images binding bills per unique transformation, so an open set lets any
// caller mint billed transforms. The pipeline and the route share them; a mismatch is a 400 mid-article.

export const THUMB_WIDTHS = [160, 320, 640];

// The 44rem prose column is about 704 CSS px, so 1408 physical px on a 2x display.
const CONTENT_WIDTHS = [640, 1024, 1408];

export const ALL_WIDTHS = [...new Set([...THUMB_WIDTHS, ...CONTENT_WIDTHS])];

// CSS pixels, never physical: the browser multiplies by the device pixel ratio itself.
export const CONTENT_SIZES = "(min-width: 46rem) 704px, calc(100vw - 2rem)";

/**
 * @param {string} key
 */
export function contentSrcSet(key) {
  return CONTENT_WIDTHS.map((width) => `/media/${key}?w=${width} ${width}w`).join(", ");
}
