import { PUBLICATIONS } from "~/data/publications";
import { toBibtexAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { exportHeaders, SHOWCASE_TYPES } from "~/lib/publications/export-response.mjs";

/**
 * The showcase filter applies: an abstract beside its paper double-counts a work. No
 * `Content-Disposition: attachment`: people read citation files as often as they save them.
 */
export function loader() {
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  return new Response(toBibtexAll(papers), {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL, "publications.bib"),
  });
}
