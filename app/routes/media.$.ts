import { getEnv } from "~/lib/context";
import { bucketFor, cropSafe } from "~/lib/media/classify.mjs";
import { WEBP_QUALITY } from "~/lib/media/encoding.mjs";
import { ALL_WIDTHS, THUMB_WIDTHS } from "~/lib/media/widths.mjs";
import type { Route } from "./+types/media.$";

/**
 * Serves editor-uploaded media from R2, and derives thumbnails from it. Keys are immutable by
 * construction, so responses carry a one year immutable cache and an ETag.
 *
 * `?w=` returns a transform of the ORIGINAL, computed on request. NOTHING IS EVER WRITTEN BACK TO
 * THE BUCKET: one object, every size derived from it, which is what keeps R2 free of variant sprawl.
 *
 * It uses the Images BINDING rather than the `/cdn-cgi/image/` URL syntax, and that is forced rather
 * than preferred: the URL interface requires a customer zone and this site is served from
 * workers.dev.
 *
 * The transform is CACHED explicitly through the Cache API, because the binding's own responses are
 * not cached and every uncached call is a full decode and re-encode and a billed transformation.
 */
/**
 * SVG IS SERVED AS AN ATTACHMENT, NEVER INLINE.
 *
 * An SVG is a document, not a picture: it can carry `<script>`, `<foreignObject>` and external
 * references. Anything in this bucket arrived through the upload form, `image/svg+xml` is allowed
 * there, and this route serves it from the SITE'S OWN ORIGIN, so inline a stored SVG is script
 * running as the site.
 *
 * The CSP blocks that today and THIS RULE IS KEPT ANYWAY. Defence in depth, deliberately: it does
 * not depend on the CSP, does not move if a directive is loosened, and holds for any client that
 * ignores the policy.
 *
 * `attachment` rather than a sandbox or a nonce, because nothing legitimately renders an R2 SVG
 * inline. Applied by the STORED content type, so a file renamed to `.png` on the way in is caught.
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
    // TWO closed sets, unioned. An open set lets any caller mint unlimited distinct transforms of one
    // object, each a separately billed transformation and a separate cache entry.
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

/*
 * `bucketFor` MOVED to `classify.mjs`. It was one of three copies of one expression with nothing
 * holding them together, and `check:invariants` now fails if a second reappears.
 */

async function serveThumbnail(env: Env, request: Request, key: string, width: number) {
  // Keyed by the full request URL, so each width is its own entry and the original is untouched.
  //
  // THIS KEY CARRIES NO HEADERS, SO `Vary` CANNOT HELP IT. The lookup presents a synthetic Request
  // built from the URL alone, so any response served from here must depend on nothing but the KEY.
  //
  // THE ENCODER SETTINGS ARE THEREFORE IN THE KEY. `WEBP_QUALITY` is an input to the body, and
  // changing it without moving the key left every entry stored under the old encoder live, reachable
  // and `immutable` for a year. There is no purge door for this cache and workers.dev has no zone to
  // purge through, so the key is the only lever. Hard rule 20.
  //
  // A SYNTHETIC PARAMETER, never served and never linked, the same shape `workers/app.ts` uses to get
  // the resolved theme into its own key.
  //
  // `caches.default` is the Workers runtime's own cache; the DOM lib does not declare it, so the cast
  // narrows to the runtime that actually serves this.
  const cache = (caches as typeof caches & { default: Cache }).default;
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set("__enc", `webp${WEBP_QUALITY}`);
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const object = await bucketFor(env, key).get(key);
  if (!object) return new Response("Not found", { status: 404 });

  // The binding is configured in `wrangler.jsonc`, which this repo does not track, so a clone or a
  // rebuilt config can be missing it. Named explicitly, or the failure looks like a slow grid rather
  // than a missing binding.
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

  // ADMIN TILES CROP, CONTENT DOES NOT. A tile is a fixed strip that already crops in CSS, so
  // cropping server-side is strictly better: saliency detection keeps the subject where `object-fit`
  // keeps the centre. A content image in the prose column has no fixed height and must never be
  // cropped at all, because the author chose the framing.
  //
  // ROSTER PHOTOS ARE EXEMPT EVEN AT TILE SIZES: they are group photographs, and `fit: "cover"` cuts
  // faces off the edge of the frame.
  const isTile = THUMB_WIDTHS.includes(width as (typeof THUMB_WIDTHS)[number]);
  const crop = isTile && cropSafe(key);

  // ONE FORMAT, UNCONDITIONALLY. WebP, for everyone, regardless of `Accept`.
  //
  // NEGOTIATION MAY NOT COME BACK HERE. The `caches.default` key above is built from the URL with no
  // headers, so a body that depended on `Accept` would be stored once and served to every client under
  // `immutable`, which is what happened for a year.
  //
  // It was dropped on the measurement as well as the mechanism: AVIF beat WebP by about a percent on
  // the same source, which is not worth a second cache layer's worth of subtlety.
  //
  // There is no `<picture>` element anywhere in this codebase. Its usual job is exactly this fallback,
  // and there is now nothing to fall back between.
  const format = "image/webp";

  let response: Response;
  try {
    const result = await env.IMAGES.input(object.body)
      .transform({ width, ...(crop ? { fit: "cover", gravity: "auto" } : {}) })
      .output({ format, quality: WEBP_QUALITY });
    response = result.response();
  } catch {
    // A file the transformer cannot read is not an error worth a 500: the grid should still show
    // something. Falling back to the original is safe HERE, where it is one tile, and is exactly what
    // must not happen silently as a general strategy.
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
  // NO `Vary` HEADER, deliberately. The body depends on no request header, and advertising a `Vary`
  // the `caches.default` key cannot honour reads as a guarantee this layer cannot make. The
  // `x-media-thumb` header makes the transform observable from outside.
  headers.set("x-media-thumb", `w=${width}`);
  const out = new Response(response.body, { headers });

  // Cached after the response is built. The clone is required: a body can only
  // be read once, and the reader must get the copy that is not consumed here.
  await cache.put(cacheKey, out.clone());
  return out;
}
