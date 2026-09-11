/**
 * The two attribute sets a post cover `<img>` gets, as functions a test can
 * call.
 *
 * **THEY LIVED IN `app/routes/blog.$slug.tsx` AND MOVED HERE 2026-09-11**, in
 * the commit that gave the cover its `width` and `height`. The move is the
 * reason the new behaviour has a test at all: a helper inside a `.tsx` route
 * is reachable only by rendering the route, so the only thing that could have
 * asserted the dimensions was a regex over the source, which reads the
 * markup's spelling rather than the attributes a reader gets.
 *
 * Pure and dependency-light on purpose. No React, no Env, no filesystem: the
 * inputs are a `src` string out of D1 and the ladders `widths.mjs` owns, and
 * the outputs are spreadable objects.
 *
 * ## THE COVER IS THE LCP ELEMENT
 *
 * That is the whole reason both of these exist. It is the first image on the
 * page and, when present, the element the metric measures, which is why the
 * route marks it eager and high priority against the usual advice, and why an
 * intrinsic size on it is worth more than on anything below it.
 */

import { dimensionsFromKey } from "./media/classify.mjs";
import { CONTENT_SIZES, contentSrcSet } from "./media/widths.mjs";

/**
 * `srcset` and `sizes` for a cover, or nothing at all.
 *
 * THE SAME TEST AND THE SAME LADDER the markdown pipeline applies to a body
 * image, reached through the same two exports rather than restated: a width the
 * page advertises and the transform route refuses is a broken image in the
 * header. `contentSrcSet` and `CONTENT_SIZES` are the one owner of both.
 *
 * A `/media/` key is an R2 object the transform route will serve at the closed
 * content ladder. Anything else is a static asset under `public/`, served
 * straight from the assets host, and gets a plain `src`: correct rather than
 * degraded, since the file is already the only size it has.
 *
 * Returns a spreadable object so the caller has no branch in its markup, and
 * the empty case spreads to nothing rather than to `undefined` attributes.
 *
 * @param {string} src
 * @returns {{ srcSet?: string, sizes?: string }}
 */
export function coverResponsive(src) {
  if (!src.startsWith("/media/")) return {};
  return { srcSet: contentSrcSet(src.slice("/media/".length)), sizes: CONTENT_SIZES };
}

/**
 * The cover's intrinsic size, READ OUT OF THE KEY.
 *
 * ## WHY THE KEY AND NOT THE DATABASE
 *
 * The comment beside the `<img>` used to say "NO WIDTH OR HEIGHT, and that is
 * a gap rather than a decision. D1 stores `cover_image` and `cover_alt` and no
 * dimensions, so nothing here can state an intrinsic size without a schema
 * change and a second read." Both halves of that are true and the conclusion
 * did not follow: an uploaded object's key IS its dimensions. `contentKey`
 * writes `<digest>-<width>x<height>.<ext>`, `dimensionsFromKey` reads the two
 * groups back out of the one statement of that grammar, and the whole thing is
 * a pure function of the string D1 already holds. No schema change, no second
 * read, no request-time measurement.
 *
 * This is the same resolver the PROSE images have always used.
 * `makeResolveImage` takes exactly this path for a `/media/` src, which is why
 * every image inside a post body has carried `width` and `height` since the
 * pipeline was written while the cover above it did not.
 *
 * ## WHAT IT CANNOT DO, and it is the half worth knowing
 *
 * A STATIC cover under `public/` carries no dimensions in its path, because
 * there is no key to carry them. The prose pipeline measures those bytes at
 * BUILD time; this runs per request against a D1 column and has no
 * filesystem. So a static cover returns nothing and renders as it did before,
 * and the bounded-height shift the CSS already handles is still its only
 * protection. Closing that case means the dimensions reaching D1, which is a
 * schema change and a separate decision.
 *
 * **AND IT IS NOT A FALLBACK.** Returning `{}` is not hard rule 13's
 * substitution class: nothing is standing in for a measurement that failed to
 * arrive, because a static path never had one. An invented default here would
 * be the rule-13 defect, and it would be worse than the gap, since a wrong
 * intrinsic size distorts the image instead of merely failing to reserve
 * space for it.
 *
 * @param {string} src
 * @returns {{ width?: number, height?: number }}
 */
export function coverDimensions(src) {
  const dimensions = dimensionsFromKey(src);
  return dimensions ? { width: dimensions.width, height: dimensions.height } : {};
}
