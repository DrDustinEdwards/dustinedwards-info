import { listPublishedLibraryRecords } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { LIBRARY_PATH, libraryItems, libraryRecords } from "~/lib/procedures/library.mjs";
import { PROCEDURES_CACHE_TAG } from "~/lib/procedures/route";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/protocols[.json]";

/** The library as JSON, for the filter state in the query string (the page's own parameters). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const items = libraryItems(await listPublishedLibraryRecords(getEnv(context)));
  const rows = libraryRecords(items, new URL(request.url).searchParams, SITE_ORIGIN);
  return new Response(`${JSON.stringify({ count: rows.length, protocols: rows }, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      "x-robots-tag": "noindex",
      link: canonicalLink(LIBRARY_PATH),
    },
  });
}
