import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { LICENSE_LINK } from "~/lib/license.mjs";
import { canonicalLink } from "~/lib/markdown-twin";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { baseAtLibrary, baseItems, baseRecords } from "~/kb/libraries.mjs";
import { LICENSE_URL, SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/kb-library[.json]";

/** A knowledge base's library as JSON, for the filter state in the query string. Not there until the base has a published entry. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const base = baseAtLibrary(url.pathname.replace(/\.json$/, ""));
  const items = base ? baseItems(base, await listPublishedRecordsOfProfile(getEnv(context), base.profile)) : [];
  if (!base || items.length === 0) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const rows = baseRecords(base, items, url.searchParams, SITE_ORIGIN);
  return new Response(`${JSON.stringify({ license: LICENSE_URL, count: rows.length, [base.id]: rows }, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      "x-robots-tag": "noindex",
      link: `${canonicalLink(base.library)}, ${LICENSE_LINK}`,
    },
  });
}
