import { PUBLICATIONS } from "~/data/publications";
import { exportHeaders, SHOWCASE_TYPES } from "~/lib/publications/export-response.mjs";
import { toRisAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

/**
 * The whole list as RIS, on the same terms as the BibTeX form.
 *
 * `application/x-research-info-systems` is the type EndNote, Zotero and Mendeley
 * register against. `text/plain` would render in the browser and import
 * nowhere, which is the wrong trade for a format nobody reads by choice.
 */
export function loader() {
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  return new Response(toRisAll(papers), {
    headers: exportHeaders("application/x-research-info-systems", SHARED_CACHE_CONTROL, "publications.ris"),
  });
}
