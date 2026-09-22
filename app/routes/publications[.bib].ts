import { PUBLICATIONS } from "~/data/publications";
import { toBibtexAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { exportHeaders, SHOWCASE_TYPES } from "~/lib/publications/export-response.mjs";

/**
 * The whole list as BibTeX.
 *
 * THE SHOWCASE FILTER APPLIES. The excluded records are conference abstracts whose papers are also in
 * the corpus, and a bibliography carrying both double-counts the same work in a reference manager,
 * which is harder to notice than a missing entry. The PER-PAPER exports are NOT filtered, because
 * asking for one record's BibTeX is asking for that record.
 *
 * A RESOURCE ROUTE, NOT A DOWNLOAD. No `Content-Disposition: attachment`: people look at a citation
 * file as often as they save it, and reference managers key on the content type.
 */
export function loader() {
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  return new Response(toBibtexAll(papers), {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL, "publications.bib"),
  });
}
