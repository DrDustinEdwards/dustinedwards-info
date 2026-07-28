import { getEnv } from "~/lib/context";
import type { Route } from "./+types/media.$";

/**
 * Serves editor-uploaded media from R2.
 *
 * This is the first read path the MEDIA bucket has ever had. Keys are immutable
 * by construction (the upload route adds a random suffix), so responses carry a
 * one year immutable cache and an ETag.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) return new Response("Not found", { status: 404 });

  const object = await getEnv(context).MEDIA.get(key);
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
