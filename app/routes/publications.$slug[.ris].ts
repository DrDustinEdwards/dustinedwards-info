import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toRis } from "~/lib/publications/exports.mjs";
import { publicationBySlug } from "~/lib/publications/by-slug";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.ris]";

export function loader({ params }: Route.LoaderArgs) {
  const paper = publicationBySlug(params.slug);
  return new Response(`${toRis(paper)}\n`, {
    headers: exportHeaders("application/x-research-info-systems", SHARED_CACHE_CONTROL, `${params.slug}.ris`),
  });
}
