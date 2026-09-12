import { PUBLICATIONS } from "~/data/publications";
import { toBibtexAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { exportHeaders, SHOWCASE_TYPES } from "~/lib/publications/export-response.mjs";

/**
 * The whole list as BibTeX.
 *
 * ## THE WHOLE LIST MEANS THE WHOLE RENDERED LIST
 *
 * The showcase filter applies, so this is the 33 works the index shows rather
 * than all 36. The three excluded are conference abstracts whose papers are
 * also in the corpus, and a bibliography carrying both the meeting abstract and
 * the paper it became double-counts the same work in a reference manager, which
 * is a harder mistake to notice than a missing entry.
 *
 * The per-paper exports are NOT filtered, because asking for one record's
 * BibTeX is asking for that record.
 *
 * ## A RESOURCE ROUTE, NOT A DOWNLOAD
 *
 * No `Content-Disposition: attachment`. A citation file is something people
 * look at as often as they save it, and a browser that downloads a 40 KB text
 * file the reader wanted to glance at is a worse outcome than one that shows
 * it. Reference managers key on the content type, not the disposition.
 */
export function loader() {
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  return new Response(toBibtexAll(papers), {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL),
  });
}
