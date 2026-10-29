import { getEnv } from "~/lib/context";
import { bucketFor } from "~/lib/media/classify.mjs";
import { images } from "~/lib/media/images.mjs";
import type { Route } from "./+types/media.$";
import { IMMUTABLE_CACHE_CONTROL } from "~/lib/seo";

/**
 * The original, or one size for `?w=` (site-runtime ./image, from the site's one `defineImages` in
 * app/lib/media/images.mjs): the closed width set, the ETag and 304, the edge cache with the quality in its
 * key, the Images binding, the original when the binding is absent or a transform fails, and a stored SVG
 * only ever as an attachment. The sandboxed /media CSP (MEDIA_CSP in workers/csp.mjs, applied by the
 * Renderer) blocks an SVG too, so neither wall depends on the other.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) return new Response("Not found", { status: 404 });

  const env = getEnv(context);
  const read = () => bucketFor(env, key).get(key);
  // `caches.default` is the Workers runtime's; the DOM lib does not declare it, hence the cast.
  const cache = (caches as typeof caches & { default: Cache }).default;
  return images.respond(request, {
    object: await read(),
    images: env.IMAGES,
    cache,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    reread: read,
  });
}
