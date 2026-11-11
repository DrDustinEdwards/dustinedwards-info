import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { bibtexOf } from "~/lib/publications/exports.mjs";
import { getEnv } from "~/lib/context";
import { publicationBySlug } from "~/lib/publications/by-slug";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.bib]";

export async function loader({ params, context }: Route.LoaderArgs) {
  const paper = await publicationBySlug(getEnv(context), params.slug);
  return new Response(`${bibtexOf(paper)}\n`, {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL, `${params.slug}.bib`),
  });
}
