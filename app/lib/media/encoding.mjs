/**
 * The encoder settings every Images-binding call in this repo emits at.
 *
 * `.mjs` and dependency-free for the reason `widths.mjs` and `classify.mjs`
 * are: the transform route, the media rebuild and the queue consumer are three
 * separate Worker entry points, and a second spelling of this value is how two
 * of them come to disagree about what they store.
 *
 * ## OMITTING QUALITY IS NOT A NEUTRAL DEFAULT
 *
 * With no `quality`, the Images binding returns LOSSLESS WebP, which on a
 * photograph is pathological rather than merely conservative: the encoder is
 * asked to reproduce a source that has already thrown information away, and it
 * spends whatever it takes.
 *
 * Measured 2026-09-01 against a 188,876 byte lossy origin (a `VP8` chunk), the
 * first content object ever put in the bucket. Every rung of the content ladder
 * came back `VP8L` and LARGER than the object it resizes: 640px at 404,020
 * bytes, 1024px at 944,030, 1408px at 979,922. A ladder heavier than its
 * original inverts the entire purpose of `srcset`, and each rung is a
 * separately billed transformation for the privilege.
 *
 * 85 is Cloudflare's own documented default for resizing.
 *
 * ## THE SECOND SITE, FOUND 2026-09-06
 *
 * The ladder fix landed in `app/routes/media.$.ts` alone, and the constant
 * stayed a module-level private there. `placeholderFor` in
 * `app/lib/media/rebuild.server.ts` calls the same binding with the same
 * omission, so every LQIP the rebuild has ever stored is a lossless VP8L data
 * URI, inside a column whose whole purpose is to be small enough to inline.
 * Measured 2026-09-06 against the live index: 26 stored placeholders, 26 of
 * them VP8L, over static files, an R2 upload and the OG cards alike.
 * FAILURES.md's "a fix in N-1 of N sites is not a fix" line, second instance on
 * this exact defect.
 *
 * That is why the value moved here rather than being exported from the route:
 * a route module is not a place two library modules can import from without
 * dragging a router entry point into the rebuild path.
 *
 * `check:image-weight` is the instrument, in both directions: for every
 * lossy-origin R2 image it asserts that every rung comes back smaller than the
 * origin, and for every stored placeholder it asserts the bytes decode as VP8
 * rather than VP8L.
 */
export const WEBP_QUALITY = 85;
