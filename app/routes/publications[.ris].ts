import { listPublishedPublications } from "~/db/publications";
import { getEnv } from "~/lib/context";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { isShowcase } from "~/lib/publications/showcase.mjs";
import { toRisAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications[.ris]";

/** The type EndNote, Zotero and Mendeley register against; `text/plain` would render and import nowhere. */
export async function loader({ context }: Route.LoaderArgs) {
  const papers = (await listPublishedPublications(getEnv(context))).filter(isShowcase);
  return new Response(toRisAll(papers), {
    headers: exportHeaders(
      "application/x-research-info-systems",
      SHARED_CACHE_CONTROL,
      "publications.ris",
    ),
  });
}
