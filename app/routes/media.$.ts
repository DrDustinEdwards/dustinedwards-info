import { getEnv } from "~/lib/context";
import { cropSafe, storageOf } from "~/lib/media/classify.mjs";
import { ALL_WIDTHS, THUMB_WIDTHS } from "~/lib/media/widths.mjs";
import type { Route } from "./+types/media.$";

/**
 * Serves editor-uploaded media from R2, and derives thumbnails from it.
 *
 * Keys are immutable by construction (the upload route adds a random suffix),
 * so responses carry a one year immutable cache and an ETag.
 *
 * ## Thumbnails, ruling 3
 *
 * `?w=160|320|640` returns a transform of the ORIGINAL, computed on request.
 * Nothing is ever written back to the bucket: one object, every size derived
 * from it, which is what keeps R2 free of variant sprawl and is why the bucket
 * needs no lifecycle rules.
 *
 * **It uses the Images BINDING rather than the `/cdn-cgi/image/` URL syntax,
 * and that is forced rather than preferred.** Measured 2026-08-02: the URL
 * interface answers 404 with Cloudflare error 1042 on this hostname, because
 * transformations there require a customer zone and this site is served from
 * `workers.dev`. The binding is not zone-scoped and was verified working
 * against the real edge before any of this was written. Both mechanisms are
 * URL-derived from the caller's point of view, which is what the ruling asks
 * for; only the implementation differs, and this one keeps working after the
 * DNS cutover as well.
 *
 * The transform is CACHED explicitly through the Cache API. The binding's own
 * responses are not cached by Cloudflare, and every uncached call is a full
 * decode and re-encode, which is both slow and a billed transformation. The
 * grid renders many thumbnails at once, so an uncached path here would be paid
 * for on every visit to the page.
 */
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

  return new Response(object.body, { headers });
}

/**
 * Which bucket holds this key.
 *
 * Two buckets split on LIFECYCLE: MEDIA is irreplaceable, OG holds cards a
 * command regenerates. `storageOf` already answers the question from the key
 * shape, so this asks it rather than testing the prefix a second time and giving
 * the answer somewhere it could drift.
 */
function bucketFor(env: Env, key: string): R2Bucket {
  return storageOf(key) === "r2-derived" ? env.OG : env.MEDIA;
}

async function serveThumbnail(env: Env, request: Request, key: string, width: number) {
  // Keyed by the full request URL, so each width is its own entry and the
  // original is untouched. Safe to cache forever for the same reason the
  // original is: the key never changes meaning.
  // `caches.default` is the Workers runtime's own cache. The DOM lib's
  // CacheStorage type does not declare it, so the cast is narrowing to the
  // runtime that actually serves this, not papering over an unknown.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
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

  // FORMAT NEGOTIATION, done here because the BINDING CANNOT DO IT.
  //
  // The ruling said `format=auto`. That exists on the `/cdn-cgi/image/` URL
  // interface, which this site cannot use: it needs a customer zone and answers
  // 404 with error 1042 on workers.dev. The binding's `output()` accepts only
  // concrete formats and the typecheck is what said so, so "auto" here is a
  // literal Accept-header negotiation rather than a flag.
  //
  // The outcome the ruling wanted is unchanged, and so is its corollary: there
  // is still no <picture> element anywhere in this codebase, because its usual
  // job is exactly this fallback and it is being done server-side instead. One
  // <img>, one URL per width.
  const accept = request.headers.get("accept") ?? "";
  const format = accept.includes("image/avif")
    ? "image/avif"
    : accept.includes("image/webp")
      ? "image/webp"
      : "image/jpeg";

  let response: Response;
  try {
    const result = await env.IMAGES.input(object.body)
      .transform({ width, ...(crop ? { fit: "cover", gravity: "auto" } : {}) })
      .output({ format });
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
  // REQUIRED, not decorative. The response body now depends on the request's
  // Accept header, and this URL is cached both in caches.default and by Workers
  // Cache in front of the Worker. Without this a browser that asked for AVIF
  // would poison the entry for one that cannot decode it, and the failure would
  // be a broken image for some readers and not others.
  headers.set("vary", "Accept");
  // Makes the transform observable from outside, which is what lets a
  // verification prove the grid is not being served full-resolution originals.
  headers.set("x-media-thumb", `w=${width}`);
  const out = new Response(response.body, { headers });

  // Cached after the response is built. The clone is required: a body can only
  // be read once, and the reader must get the copy that is not consumed here.
  await cache.put(cacheKey, out.clone());
  return out;
}
