import { getEnv } from "~/lib/context";
import { bucketFor, cropSafe } from "~/lib/media/classify.mjs";
import { WEBP_QUALITY } from "~/lib/media/encoding.mjs";
import { ALL_WIDTHS, THUMB_WIDTHS } from "~/lib/media/widths.mjs";
import type { Route } from "./+types/media.$";

/**
 * Serves editor-uploaded media from R2, and derives thumbnails from it.
 *
 * Keys are immutable by construction, so responses carry a one year immutable
 * cache and an ETag.
 *
 * ## Thumbnails, ruling 3
 *
 * `?w=` returns a transform of the ORIGINAL, computed on request. Nothing is
 * ever written back to the bucket: one object, every size derived from it, which
 * is what keeps R2 free of variant sprawl and is why the bucket needs no
 * lifecycle rules.
 *
 * **It uses the Images BINDING rather than the `/cdn-cgi/image/` URL syntax,
 * and that is forced rather than preferred.** Measured 2026-08-02: the URL
 * interface answers 404 with Cloudflare error 1042 on this hostname, because
 * transformations there require a customer zone and this site is served from
 * `workers.dev`. The binding is not zone-scoped and was verified working
 * against the real edge before any of this was written.
 *
 * The transform is CACHED explicitly through the Cache API. The binding's own
 * responses are not cached by Cloudflare, and every uncached call is a full
 * decode and re-encode, which is both slow and a billed transformation.
 */
/**
 * SVG IS SERVED AS AN ATTACHMENT, NEVER INLINE.
 *
 * An SVG is a document, not a picture: it can carry `<script>`, `<foreignObject>`
 * and external references. Anything in this bucket arrived through the upload
 * form, `image/svg+xml` is on the allowed list in `upload-contract.mjs`, and
 * this route serves it from the SITE'S OWN ORIGIN. Inline, a stored SVG is
 * script running as the site.
 *
 * **The CSP now BLOCKS that, and this rule is kept anyway.** Enforcement landed
 * 2026-08-17, and `workers/app.ts` stamps the policy on EVERY response with no
 * early return, so a `/media/*` document is governed by
 * `script-src 'nonce-...' 'strict-dynamic'` and an inline script inside a
 * stored SVG carries no nonce. Until then the comment here read "the CSP is
 * still Report-Only so it would report the execution rather than prevent it",
 * which is why the wording is being replaced rather than deleted: the sentence
 * was true when written and had gone false in the SAFE direction, which is the
 * kind that never announces itself.
 *
 * Defence in depth, deliberately. This rule does not depend on the CSP, does
 * not move if a directive is loosened, and holds for any client that ignores
 * the policy.
 *
 * `attachment` is the fix rather than a sandbox or a nonce because nothing
 * legitimately renders an R2 SVG inline: the brand marks and the diagram pairs
 * are STATIC assets whose keys begin with `/`, served by the assets host and
 * never through here (`thumbUrl` returns such keys untouched, and a grep of
 * app/ and content/ for `/media/*.svg` finds nothing).
 *
 * Applied by the STORED content type, so a file renamed to `.png` on the way in
 * is still caught, and a future allowed type with the same property has one
 * place to be added.
 *
 * @param {Headers} headers Headers already carrying the object's metadata.
 */
function attachIfActive(headers: Headers) {
  const type = (headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("image/svg+xml")) return;
  headers.set("content-disposition", "attachment");
  // Belt and braces: an attachment that a browser sniffs back to SVG would
  // defeat the disposition on its own.
  headers.set("x-content-type-options", "nosniff");
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) return new Response("Not found", { status: 404 });

  const env = getEnv(context);
  const requested = new URL(request.url).searchParams.get("w");

  if (requested) {
    const width = Number(requested);
    // TWO closed sets, unioned. An open set lets any caller mint unlimited
    // distinct transforms of one object, each a separately billed unique
    // transformation and a separate cache entry, so both sets stay closed.
    if (!ALL_WIDTHS.includes(width as (typeof ALL_WIDTHS)[number])) {
      return new Response("Unsupported width", { status: 400 });
    }
    return serveThumbnail(env, request, key, width);
  }

  const object = await bucketFor(env, key).get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const etag = object.httpEtag;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", etag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  attachIfActive(headers);

  return new Response(object.body, { headers });
}

/* `bucketFor` MOVED to `classify.mjs`. It was one of three copies of the same
 * expression, all agreeing, with nothing holding them together;
 * `check:invariants` now fails if a second one reappears. */

async function serveThumbnail(env: Env, request: Request, key: string, width: number) {
  // Keyed by the full request URL, so each width is its own entry and the
  // original is untouched. Safe to cache forever for the same reason the
  // original is: the key never changes meaning.
  //
  // **THIS KEY CARRIES NO HEADERS, SO `Vary` CANNOT HELP IT.** The lookup
  // presents a synthetic Request built from the URL alone, so there is no
  // `Accept` (or anything else) for a variant to be matched against. Workers
  // Cache in front of the Worker DOES honour `Vary` on any header, but this
  // layer does not and cannot. Any response served from here must therefore
  // depend on nothing but the KEY. See the format note below.
  //
  // ## THE ENCODER SETTINGS ARE IN THE KEY, AND THE OMISSION WAS MEASURED
  //
  // The sentence above used to end "nothing but the URL", and that stopped
  // being true the moment `WEBP_QUALITY` became an input to the body. Adding it
  // changed what this route produces and orphaned NOTHING: every entry stored
  // under the old encoder stayed live, reachable and `immutable` for a year.
  //
  // Measured on production 2026-09-02, hours after the quality fix deployed,
  // on the canonical `srcset` URLs a reader's browser actually requests:
  //
  //     w=320   plain 119,196 B VP8L (HIT)   cold key 28,446 B VP8
  //     w=1408  plain 979,922 B VP8L (HIT)   cold key 198,908 B VP8
  //
  // The code was correct and readers were still being served the pre-fix
  // lossless bodies. Invalidation was per-colo and partial, so reading one URL
  // and generalising said the opposite of the truth. There is no purge door for
  // this cache, and `workers.dev` has no zone to purge through the API, so the
  // key is the only lever.
  //
  // A SYNTHETIC PARAMETER, never served and never linked, exactly the shape
  // `workers/app.ts` uses to get the resolved theme into its own key. Changing
  // the encoder now moves every entry to a new key by construction.
  //
  // Hard rule 20.
  //
  // `caches.default` is the Workers runtime's own cache. The DOM lib's
  // CacheStorage type does not declare it, so the cast is narrowing to the
  // runtime that actually serves this, not papering over an unknown.
  const cache = (caches as unknown as { default: Cache }).default;
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set("__enc", `webp${WEBP_QUALITY}`);
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const object = await bucketFor(env, key).get(key);
  if (!object) return new Response("Not found", { status: 404 });

  // The binding is configured in wrangler.jsonc, which this repo does not track
  // (it carries account ids). A clone or a rebuilt config can therefore be
  // missing it, and the failure would otherwise look like a slow grid rather
  // than a missing binding. Named explicitly so it is diagnosable from a
  // response header instead of from a guess.
  if (!env.IMAGES) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-media-thumb", "unavailable-no-images-binding");
    // The no-Images-binding fallback serves the ORIGINAL bytes, so an SVG
    // reaches the reader through here too and needs the same treatment.
    attachIfActive(headers);
    return new Response(object.body, { headers });
  }

  // ADMIN TILES CROP, CONTENT DOES NOT.
  //
  // The two width sets serve different shapes. `.media-thumb` is a fixed 10rem
  // strip that already crops in CSS, so cropping server-side as well is strictly
  // better: `gravity: "auto"` uses saliency detection to keep the subject, where
  // CSS `object-fit: cover` blindly keeps the centre, and the smaller body is
  // fewer bytes over the wire. A content image in the prose column has no fixed
  // height and must never be cropped at all: the author chose the framing.
  //
  // ROSTER PHOTOS ARE EXEMPT EVEN AT TILE SIZES. They are group photographs and
  // `fit: "cover"` cuts faces off the edge of the frame, which is the one thing
  // a photo of named people may not do.
  const isTile = THUMB_WIDTHS.includes(width as (typeof THUMB_WIDTHS)[number]);
  const crop = isTile && cropSafe(key);

  // ONE FORMAT, UNCONDITIONALLY. WebP, for everyone, regardless of Accept.
  //
  // **This used to negotiate AVIF/WebP/JPEG from `Accept` and set
  // `Vary: Accept`, which was a live cache-poisoning bug.** The `caches.default`
  // key above is built from the URL with no headers, so `put` and `match` both
  // presented an empty `Accept` and every client collapsed onto whichever format
  // the first caller happened to get, for a year, under `immutable`. Found by an
  // external audit 2026-08-02.
  //
  // **A PRECISION THAT MATTERS, because the first write-up of this got it
  // wrong:** the failure was specific to `caches.default`, NOT to `Vary` in
  // general. Only the manual key here could not vary at all.
  //
  // **CORRECTED 2026-08-05, because the correction was itself wrong.** This
  // comment used to claim "Workers Cache honours `Vary` on any request header
  // with no allowlist, so the outer layer would have keyed correctly". That is
  // not what the docs say and it is half wrong by measurement:
  //
  //   - developers.cloudflare.com/workers/cache/cache-keys/ lists the Workers
  //     Caching key as the target entrypoint, the path and query string, the
  //     Worker version and `ctx.props`. `Vary` is NOT part of it.
  //   - developers.cloudflare.com/cache/how-to/cache-rules/settings/#vary makes
  //     origin `Vary` a Cache Rules setting that is OFF unless configured, and
  //     Cache Rules need a proxied zone, which workers.dev does not have.
  //
  // Measured on this site with a paired control: `Accept` DOES separate stored
  // variants, but on a response varying on two headers the `Cookie` dimension
  // collapses once a second variant exists, which is the defect repaired in
  // `search.tsx` and `markdown-twin.ts`. So "keying correctly" was true for the
  // header this route cared about and false in general, and relying on it would
  // have been relying on undocumented behaviour.
  //
  // Keeping the negotiation was therefore possible only in the narrow sense
  // that `Accept` happens to separate. The decision below stands on the
  // measurement, not on this mechanism.
  //
  // It was still dropped, on the measurement rather than the mechanism: AVIF
  // came in at 21797 bytes against WebP's 22072 for the same source, 275 bytes,
  // 1.2%. That is not worth a second cache layer's worth of subtlety, and this
  // layer exists for a real reason (an uncached binding call is a full decode
  // and re-encode, and a billed transformation, on a grid that renders many
  // tiles at once).
  //
  // There is still no <picture> element anywhere in this codebase. Its usual job
  // is exactly this fallback, and there is now nothing to fall back between.
  const format = "image/webp";

  let response: Response;
  try {
    const result = await env.IMAGES.input(object.body)
      .transform({ width, ...(crop ? { fit: "cover", gravity: "auto" } : {}) })
      .output({ format, quality: WEBP_QUALITY });
    response = result.response();
  } catch {
    // A file the transformer cannot read (an SVG, a corrupt upload) is not an
    // error worth a 500: the grid should still show something. Falling back to
    // the original is safe HERE, where it is one tile, and is exactly what must
    // not happen silently as a general strategy.
    const original = await bucketFor(env, key).get(key);
    if (!original) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    original.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-media-thumb", "original-fallback");
    return new Response(original.body, { headers });
  }

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // NO `Vary` HEADER, deliberately. The body no longer depends on any request
  // header, so there is nothing to vary on, and advertising a `Vary` the
  // `caches.default` key cannot honour is worse than advertising none: it reads
  // as a guarantee this layer is structurally unable to make.
  // Makes the transform observable from outside, which is what lets a
  // verification prove the grid is not being served full-resolution originals.
  headers.set("x-media-thumb", `w=${width}`);
  const out = new Response(response.body, { headers });

  // Cached after the response is built. The clone is required: a body can only
  // be read once, and the reader must get the copy that is not consumed here.
  await cache.put(cacheKey, out.clone());
  return out;
}
