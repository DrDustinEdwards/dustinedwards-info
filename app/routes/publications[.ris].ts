import { listPublishedPublications } from "~/db/publications";
import { getEnv } from "~/lib/context";
import { exportHeaders, SHOWCASE_TYPES } from "~/lib/publications/export-response.mjs";
import { toRisAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications[.ris]";

/** The type EndNote, Zotero and Mendeley register against; `text/plain` would render and import nowhere. */
export async function loader({ context }: Route.LoaderArgs) {
  const papers = (await listPublishedPublications(getEnv(context))).filter((p) => SHOWCASE_TYPES.has(p.type));
  return new Response(toRisAll(papers), {
    headers: exportHeaders("application/x-research-info-systems", SHARED_CACHE_CONTROL, "publications.ris"),
  });
}
