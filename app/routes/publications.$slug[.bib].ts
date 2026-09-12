import { PUBLICATIONS } from "~/data/publications";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toBibtex } from "~/lib/publications/exports.mjs";
import { doiSlug } from "~/lib/publications/paths.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.bib]";

/**
 * One paper's BibTeX entry.
 *
 * NOT filtered by the showcase set, unlike the whole-list export. Asking for a
 * specific record's BibTeX is asking for that record, and the three conference
 * abstracts have DOIs and pages of their own; excluding them here would mean a
 * page whose own export 404s.
 */
const BY_SLUG = new Map(PUBLICATIONS.map((p) => [doiSlug(p.doi), p]));

export function loader({ params }: Route.LoaderArgs) {
  const paper = BY_SLUG.get(params.slug ?? "");
  if (!paper) throw new Response("Not found", { status: 404 });
  return new Response(`${toBibtex(paper)}\n`, {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL),
  });
}
