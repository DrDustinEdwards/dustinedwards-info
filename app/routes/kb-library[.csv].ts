import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { LICENSE_LINK } from "~/lib/license.mjs";
import { canonicalLink } from "~/lib/markdown-twin";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { libraryCsv } from "~/kb/procedures/library.mjs";
import { baseAtLibrary, baseItems, baseRecords } from "~/kb/libraries.mjs";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/kb-library[.csv]";

/** A knowledge base's library as CSV, for the filter state in the query string. Not there until the base has a published entry. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const base = baseAtLibrary(url.pathname.replace(/\.csv$/, ""));
  const items = base ? baseItems(base, await listPublishedRecordsOfProfile(getEnv(context), base.profile)) : [];
  if (!base || items.length === 0) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const rows = baseRecords(base, items, url.searchParams, SITE_ORIGIN);
  return new Response(libraryCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      "x-robots-tag": "noindex",
      "content-disposition": `attachment; filename="dustin-edwards-${base.id}.csv"`,
      link: `${canonicalLink(base.library)}, ${LICENSE_LINK}`,
    },
  });
}
