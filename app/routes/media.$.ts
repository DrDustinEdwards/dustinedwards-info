import { imageVersion, originalKey } from "@dustinedwards/site-runtime/image";

import { getEnv } from "~/lib/context";
import { bucketFor } from "~/lib/media/classify.mjs";
import { images, isStaticMedia } from "~/lib/media/images.mjs";
import { staticPhoto } from "~/lib/media/static-media";
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
  // A size URL ends in its format's extension (`photo.webp.webp?w=640`, site-runtime 0.61.0); the stored key is the
  // path without it. A URL from before the suffix (`photo.webp?w=640`) is the key as it is.
  const key = params["*"] ? originalKey(params["*"], request) : "";
  if (!key) return new Response("Not found", { status: 404 });

  const env = getEnv(context);
  const fromAssets = isStaticMedia(key);
  const read = () => (fromAssets ? assetObject(env, key) : bucketFor(env, key).get(key));
  // `caches.default` is the Workers runtime's; the DOM lib does not declare it, hence the cast.
  const cache = (caches as typeof caches & { default: Cache }).default;
  return images.respond(request, {
    object: await read(),
    images: env.IMAGES,
    cache,
    // A static photograph keeps its name when its file changes, so only a URL carrying its current version (`v=`, the
    // digest build:assets wrote) is cached for good; any other is cached for a day.
    cacheControl: !fromAssets || currentVersion(key, request) ? IMMUTABLE_CACHE_CONTROL : "public, max-age=86400",
    reread: read,
  });
}

/** Whether the request names the static photograph's current version (its digest's first 12 characters). */
function currentVersion(key: string, request: Request) {
  const asked = new URL(request.url).searchParams.get("v");
  const { version } = staticPhoto(`/${key}`);
  return asked !== null && version !== null && imageVersion(version) === asked;
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
