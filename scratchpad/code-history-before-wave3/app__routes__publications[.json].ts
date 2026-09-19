import cslRecords from "../../data/publications.csl.json";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toCslJson } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

/**
 * The whole corpus as CSL JSON.
 *
 * ## ALL 36, NOT THE SHOWCASE 33
 *
 * The only export that is not filtered, and the reason is what CSL IS. BibTeX
 * and RIS are for putting citations in a document, where listing a conference
 * abstract beside the paper it became double-counts a work. CSL JSON is the
 * BIBLIOGRAPHIC RECORD, and the record is the record: a consumer asking for
 * this file is asking what exists, not what the index chose to display.
 *
 * ## STRAIGHT FROM THE SOURCE FILE
 *
 * `data/publications.csl.json` already IS CSL JSON, so this imports it rather
 * than rebuilding one from `publications.ts`. Rebuilding would be a second,
 * lossier derivation of something the repo holds canonically: the source
 * carries fields the site never renders, and those belong in this file.
 *
 * The one transformation is decoding character references, and `toCslJson`
 * states why: the stored escapes are a property of this site's markup, not of
 * the bibliographic record, and a reference manager importing `p &lt; 0.05`
 * shows a reader those characters.
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
