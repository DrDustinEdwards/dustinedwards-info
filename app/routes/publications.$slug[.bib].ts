import { PUBLICATIONS } from "~/data/publications";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toBibtex } from "~/lib/publications/exports.mjs";
import { doiSlug } from "~/lib/publications/paths.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.bib]";

/** Unfiltered by the showcase set: excluding a record would give a page whose own export 404s. */
const BY_SLUG = new Map(PUBLICATIONS.map((p) => [doiSlug(p.doi), p]));

export function loader({ params }: Route.LoaderArgs) {
  const paper = BY_SLUG.get(params.slug ?? "");
  if (!paper) throw new Response("Not found", { status: 404 });
  return new Response(`${toBibtex(paper)}\n`, {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL, `${params.slug}.bib`),
  });
}
