import { getEnv } from "~/lib/context";
import { THUMB_WIDTHS, type ThumbWidth } from "~/lib/media/core.server";
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
    // A CLOSED set of widths. An open one lets any caller mint unlimited
    // distinct transforms of one object, each a separately billed unique
    // transformation and a separate cache entry.
    if (!THUMB_WIDTHS.includes(width as ThumbWidth)) {
      return new Response("Unsupported width", { status: 400 });
    }
    return serveThumbnail(env, request, key, width as ThumbWidth);
  }

  const object = await env.MEDIA.get(key);
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

async function serveThumbnail(env: Env, request: Request, key: string, width: ThumbWidth) {
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

  const object = await env.MEDIA.get(key);
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

  let response: Response;
  try {
    const result = await env.IMAGES.input(object.body)
      .transform({ width })
      // webp rather than avif: encoding is markedly cheaper and these are
      // administrative thumbnails, where a few percent of file size matters
      // far less than the transform's latency and cost.
      .output({ format: "image/webp" });
    response = result.response();
  } catch {
    // A file the transformer cannot read (an SVG, a corrupt upload) is not an
    // error worth a 500: the grid should still show something. Falling back to
    // the original is safe HERE, where it is one tile, and is exactly what must
    // not happen silently as a general strategy.
    const original = await env.MEDIA.get(key);
    if (!original) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    original.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-media-thumb", "original-fallback");
    return new Response(original.body, { headers });
  }

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // Makes the transform observable from outside, which is what lets a
  // verification prove the grid is not being served full-resolution originals.
  headers.set("x-media-thumb", `w=${width}`);
  const out = new Response(response.body, { headers });

  // Cached after the response is built. The clone is required: a body can only
  // be read once, and the reader must get the copy that is not consumed here.
  await cache.put(cacheKey, out.clone());
  return out;
}
