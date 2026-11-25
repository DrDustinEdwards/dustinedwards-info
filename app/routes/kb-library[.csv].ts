import { csvResponse } from "@dustinedwards/site-runtime/csv";
import { libraryTwin, libraryTwinHeaders } from "~/kb/library-twin.server";
import { libraryCsv } from "~/kb/procedures/library.mjs";
import { baseRecords } from "~/kb/libraries.mjs";
import { SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/kb-library[.csv]";

/** A knowledge base's library as CSV, for the filter state in the query string. Not there until the base has a published entry. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const twin = await libraryTwin(request, context, "csv");
  if (twin instanceof Response) return twin;
  const { base, items, url } = twin;
  const rows = baseRecords(base, items, url.searchParams, SITE_ORIGIN);
  return csvResponse(libraryCsv(rows), `dustin-edwards-${base.id}.csv`, {
    headers: libraryTwinHeaders(base, true),
  });
}
