import { listPublishedCslRecords } from "~/db/publications";
import { getEnv } from "~/lib/context";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toCslJson } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications[.json]";

/**
 * Unfiltered: CSL JSON is the bibliographic record, and a consumer is asking what exists. The raw Crossref
 * records the files carry, decoding character references only; a paper with no Crossref record (a
 * manuscript with no DOI yet) has none to list.
 */
export async function loader({ context }: Route.LoaderArgs) {
  return new Response(toCslJson(await listPublishedCslRecords(getEnv(context))), {
    /* The type Crossref content negotiation uses; plain `application/json` says nothing about meaning. */
    headers: exportHeaders("application/vnd.citationstyles.csl+json", SHARED_CACHE_CONTROL, "publications.json"),
  });
}
