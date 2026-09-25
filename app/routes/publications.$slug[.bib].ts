import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toBibtex } from "~/lib/publications/exports.mjs";
import { publicationBySlug } from "~/lib/publications/by-slug";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.bib]";

export function loader({ params }: Route.LoaderArgs) {
  const paper = publicationBySlug(params.slug);
  return new Response(`${toBibtex(paper)}\n`, {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL, `${params.slug}.bib`),
  });
}
