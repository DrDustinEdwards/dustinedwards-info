/**
 * The transform ladders, and the `srcset` built from them.
 *
 * `.mjs` and dependency-free for the reason `classify.mjs` and `records.mjs`
 * are: the markdown pipeline imports it to write `srcset` into the artifact, the
 * Worker imports it to decide which widths it will serve, and the two must never
 * disagree. A width the pipeline advertises but the route refuses is a 400 in
 * the middle of an article.
 *
 * **Both sets are CLOSED, and that is a billing property rather than a style
 * choice.** Since 2026-07-01 the Images binding bills per UNIQUE transformation,
 * so width lands in a billing key. An open set lets any caller mint unlimited
 * distinct transforms of one object, each separately billed and each its own
 * cache entry.
 */

/**
 * Admin surfaces: the library grid tile, the picker tile, and a 2x of either.
 */
export const THUMB_WIDTHS = [160, 320, 640];

/**
 * Images inside a post, which is a different problem from a thumbnail.
 *
 * The prose column is 44rem, so a full-width slot is about 704 CSS pixels and
 * wants 1408 physical pixels on a 2x display. The largest admin width is 640,
 * which meant every content image was served at under half the resolution a
 * modern screen asks for. That is a defect this set fixes, not a refinement.
 *
 * Three stops, the low end of the 3-to-5 consensus: more breakpoints fragment
 * the cache and this corpus is small.
 */
const CONTENT_WIDTHS = [640, 1024, 1408];

/** Every width the transform route will honour, from both closed sets. */
export const ALL_WIDTHS = [...new Set([...THUMB_WIDTHS, ...CONTENT_WIDTHS])];

/**
 * How wide the slot will BE, in CSS pixels.
 *
 * The browser needs this before layout in order to choose from `srcset`, and it
 * multiplies by the device pixel ratio itself. So this describes CSS pixels and
 * never physical ones, and the whole mechanism runs with no JavaScript at all.
 *
 * 44rem at a 16px root is 704px; below that the image is the viewport less the
 * page gutters.
 */
export const CONTENT_SIZES = "(min-width: 46rem) 704px, calc(100vw - 2rem)";

/**
 * `srcset` over the content ladder, with `w` descriptors.
 *
 * `w` rather than `x`: combined with `sizes` the browser picks correctly at any
 * viewport, where `x` describes density alone and cannot adapt to a narrower
 * column.
 *
 * A pure function of the key, which is what makes it safe to write into the
 * gated artifact: no filesystem, no database, no measurement.
 *
 * @param {string} key
 */
export function contentSrcSet(key) {
  return CONTENT_WIDTHS.map((width) => `/media/${key}?w=${width} ${width}w`).join(", ");
}
