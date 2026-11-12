import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { csvResponse } from "@dustinedwards/site-runtime/csv";
import { getEnv } from "~/lib/context";
import { LICENSE_LINK } from "~/lib/license.mjs";
import { canonicalLink } from "~/lib/markdown-twin";
import {
  LIBRARY_PATH,
  libraryCsv,
  libraryItems,
  libraryRecords,
} from "~/kb/procedures/library.mjs";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/protocols[.csv]";

/** The library as CSV, for the filter state in the query string (the page's own parameters). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const items = libraryItems(await listPublishedRecordsOfProfile(getEnv(context), "protocol"));
  const rows = libraryRecords(items, new URL(request.url).searchParams, SITE_ORIGIN);
  return csvResponse(libraryCsv(rows), "dustin-edwards-protocols.csv", {
    headers: {
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      "x-robots-tag": "noindex",
      // A CSV has no place for a comment that every reader would ignore, so the terms travel in the header.
      link: `${canonicalLink(LIBRARY_PATH)}, ${LICENSE_LINK}`,
    },
  });
}
