import { getEnv } from "~/lib/context";
import { bucketFor, cropSafe } from "~/lib/media/classify.mjs";
import { WEBP_QUALITY } from "~/lib/media/encoding.mjs";
import { ALL_WIDTHS, THUMB_WIDTHS } from "~/lib/media/widths.mjs";
import type { Route } from "./+types/media.$";

/**
 * `?w=` transforms the original on request and never writes back to the bucket. The Images binding,
 * not `/cdn-cgi/image/`, because the URL interface needs a customer zone and this is workers.dev.
 * Cached explicitly: the binding's responses are not cached, and each miss is a billed transform.
 */
/**
 * SVG is served as an attachment, never inline: from the site's own origin a stored SVG is script
 * running as the site. Kept although the CSP blocks it today. Keyed on the stored content type, so a
 * file renamed to `.png` is caught.
 */
function attachIfActive(headers: Headers) {
  const type = (headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("image/svg+xml")) return;
  headers.set("content-disposition", "attachment");
  // An attachment that a browser sniffs back to SVG would defeat the disposition on its own.
  headers.set("x-content-type-options", "nosniff");
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) return new Response("Not found", { status: 404 });

  const env = getEnv(context);
  const requested = new URL(request.url).searchParams.get("w");

  if (requested) {
    const width = Number(requested);
    // Closed sets: an open set lets any caller mint unlimited billed transforms and cache entries of one object.
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

async function serveThumbnail(env: Env, request: Request, key: string, width: number) {
  // TRAP: keyed by URL alone, so `Vary` cannot help and a stored body must be a pure function of the
  // key. This cache has no purge, so every input to the body goes into the key, encoder settings
  // (`WEBP_QUALITY`) included, as a synthetic parameter never served or linked.
  // `caches.default` is the Workers runtime's; the DOM lib does not declare it, hence the cast.
  const cache = (caches as typeof caches & { default: Cache }).default;
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set("__enc", `webp${WEBP_QUALITY}`);
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const object = await bucketFor(env, key).get(key);
  if (!object) return new Response("Not found", { status: 404 });

  // The binding lives in untracked `wrangler.jsonc`, so a clone can lack it. Named explicitly, or the
  // failure looks like a slow grid.
  if (!env.IMAGES) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-media-thumb", "unavailable-no-images-binding");
    // The fallback serves the original bytes, so an SVG reaches the reader here too.
    attachIfActive(headers);
    return new Response(object.body, { headers });
  }

  // Admin tiles crop (saliency keeps the subject); content images never do, the author chose the
  // framing. Roster photos are exempt even at tile sizes: `fit: "cover"` cuts faces off.
  const isTile = THUMB_WIDTHS.includes(width as (typeof THUMB_WIDTHS)[number]);
  const crop = isTile && cropSafe(key);

  // One format, WebP, regardless of `Accept`: the cache key carries no headers, so a negotiated body
  // would be stored once and served to every client under `immutable`.
  const format = "image/webp";

  let response: Response;
  try {
    const result = await env.IMAGES.input(object.body)
      .transform({ width, ...(crop ? { fit: "cover", gravity: "auto" } : {}) })
      .output({ format, quality: WEBP_QUALITY });
    response = result.response();
  } catch (error) {
    // Falling back to the original is safe here, for one tile, and must not become a general strategy.
    console.error(`media thumbnail transform failed for ${key} at w=${width}`, error);
    const original = await bucketFor(env, key).get(key);
    if (!original) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    original.writeHttpMetadata(headers);
    /* Short, not immutable: this URL should hold the thumbnail once the transform recovers. */
    headers.set("cache-control", "public, max-age=300");
    headers.set("x-media-thumb", "original-fallback");
    // The original bytes, so an SVG reaches the reader here too.
    attachIfActive(headers);
    return new Response(original.body, { headers });
  }

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // No `Vary`: the body depends on no request header, and the key could not honor one.
  headers.set("x-media-thumb", `w=${width}`);
  const out = new Response(response.body, { headers });

  // The clone is required: a body can be read only once.
  await cache.put(cacheKey, out.clone());
  return out;
}
