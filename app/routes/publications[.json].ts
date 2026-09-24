import cslRecords from "../../data/publications.csl.json";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toCslJson } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

/**
 * Unfiltered: CSL JSON is the bibliographic record, and a consumer is asking what exists. Served
 * straight from `data/publications.csl.json`, decoding character references only.
 */
export function loader() {
  return new Response(toCslJson(cslRecords), {
    /* The type Crossref content negotiation uses; plain `application/json` says nothing about meaning. */
    headers: exportHeaders("application/vnd.citationstyles.csl+json", SHARED_CACHE_CONTROL, "publications.json"),
  });
}
