import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { LICENSE_LINK } from "~/lib/license.mjs";
import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { baseAtLibrary, baseItems } from "./libraries.mjs";

/**
 * A library's twin (.csv, .json, .md) for a request: the base, its published items and the request's URL, or the 404 the
 * twins share, since a library is not there until its base has a published entry.
 */
export async function libraryTwin(
  request: Request,
  context: Parameters<typeof getEnv>[0],
  extension: "csv" | "json" | "md",
) {
  const url = new URL(request.url);
  const base = baseAtLibrary(url.pathname.replace(new RegExp(`\\.${extension}$`), ""));
  const items = base
    ? baseItems(base, await listPublishedRecordsOfProfile(getEnv(context), base.profile))
    : [];
  if (!base || items.length === 0)
    return new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  return { base, items, url };
}

/** The headers every library twin carries; the data twins also name the license. */
export function libraryTwinHeaders(base: { library: string }, license: boolean) {
  return {
    "cache-control": SHARED_CACHE_CONTROL,
    "cache-tag": PROCEDURES_CACHE_TAG,
    "x-robots-tag": "noindex",
    link: license ? `${canonicalLink(base.library)}, ${LICENSE_LINK}` : canonicalLink(base.library),
  };
}
