import cslRecords from "../../data/publications.csl.json";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toCslJson } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

/**
 * The whole corpus as CSL JSON.
 *
 * **UNFILTERED, unlike every other export, and the reason is what CSL IS.** BibTeX and RIS are for
 * putting citations in a document, where a conference abstract beside the paper it became
 * double-counts a work. CSL JSON is the BIBLIOGRAPHIC RECORD: a consumer asking for this file is
 * asking what exists, not what the index chose to display.
 *
 * **STRAIGHT FROM THE SOURCE FILE.** `data/publications.csl.json` already IS CSL JSON, so rebuilding
 * one from `publications.ts` would be a second, lossier derivation of something the repo holds
 * canonically. The one transformation is decoding character references, which are a property of this
 * site's markup rather than of the record.
 */
export function loader() {
  return new Response(toCslJson(cslRecords), {
    /*
     * `application/vnd.citationstyles.csl+json`, which is what Crossref content
     * negotiation uses and what a CSL consumer looks for. Plain
     * `application/json` would be true and useless: it says the bytes are JSON
     * and nothing about what they mean.
     */
    headers: exportHeaders("application/vnd.citationstyles.csl+json", SHARED_CACHE_CONTROL),
  });
}
