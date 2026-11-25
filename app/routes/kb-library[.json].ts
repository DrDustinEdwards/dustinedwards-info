import { libraryTwin, libraryTwinHeaders } from "~/kb/library-twin.server";
import { baseRecords } from "~/kb/libraries.mjs";
import { LICENSE_URL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/kb-library[.json]";

/** A knowledge base's library as JSON, for the filter state in the query string. Not there until the base has a published entry. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const twin = await libraryTwin(request, context, "json");
  if (twin instanceof Response) return twin;
  const { base, items, url } = twin;
  const rows = baseRecords(base, items, url.searchParams, SITE_ORIGIN);
  return new Response(
    `${JSON.stringify({ license: LICENSE_URL, count: rows.length, [base.id]: rows }, null, 2)}\n`,
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...libraryTwinHeaders(base, true),
      },
    },
  );
}
