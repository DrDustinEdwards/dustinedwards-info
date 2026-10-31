import { originalKey } from "@dustinedwards/site-runtime/image";
import { getEnv } from "~/lib/context";
import { bucketFor } from "~/lib/media/classify.mjs";
import { images, isStaticMedia } from "~/lib/media/images.mjs";
import type { Route } from "./+types/media.$";
import { IMMUTABLE_CACHE_CONTROL } from "~/lib/seo";

/**
 * The original, or one size for `?w=` (site-runtime ./image, from the site's one `defineImages` in
 * app/lib/media/images.mjs): the closed width set, the ETag and 304, the edge cache with the quality in its
 * key, the Images binding, the original when the binding is absent or a transform fails, and a stored SVG
 * only ever as an attachment. The sandboxed /media CSP (UPLOAD_HEADERS from site-runtime, chosen in workers/csp.mjs, applied by the
 * Renderer) blocks an SVG too, so neither wall depends on the other.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const path = params["*"];
  if (!path) return new Response("Not found", { status: 404 });
  // A size URL is suffixed (photo.jpg.webp?w=640); the stored key is the original's.
  const key = originalKey(path, request);

  const env = getEnv(context);
  const fromAssets = isStaticMedia(key);
  const read = () => (fromAssets ? assetObject(env, key) : bucketFor(env, key).get(key));
  // `caches.default` is the Workers runtime's; the DOM lib does not declare it, hence the cast.
  const cache = (caches as typeof caches & { default: Cache }).default;
  return images.respond(request, {
    object: await read(),
    images: env.IMAGES,
    cache,
    // A static photograph keeps its name when its file changes, so it is cached for a day, not for good.
    cacheControl: fromAssets ? "public, max-age=86400" : IMMUTABLE_CACHE_CONTROL,
    reread: read,
  });
}

/** A static photograph from the site's assets, in the shape the image route reads from R2; null when there is none. */
async function assetObject(env: Env, key: string) {
  // The ASSETS binding ignores the hostname and matches only the pathname.
  const response = await env.ASSETS.fetch(new Request(`https://assets.local/${key}`));
  if (!response.ok || !response.body) return null;
  const contentType = response.headers.get("content-type") ?? "image/webp";
  return {
    body: response.body,
    httpEtag: response.headers.get("etag") ?? `"${key}"`,
    httpMetadata: { contentType },
    writeHttpMetadata: (headers: Headers) => headers.set("content-type", contentType),
  };
}
