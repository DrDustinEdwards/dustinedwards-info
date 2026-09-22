import { PUBLICATIONS } from "~/data/publications";
import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { toRis } from "~/lib/publications/exports.mjs";
import { doiSlug } from "~/lib/publications/paths.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.ris]";

/** One paper's RIS record. Unfiltered, for the reason the .bib twin gives. */
const BY_SLUG = new Map(PUBLICATIONS.map((p) => [doiSlug(p.doi), p]));

export function loader({ params }: Route.LoaderArgs) {
  const paper = BY_SLUG.get(params.slug ?? "");
  if (!paper) throw new Response("Not found", { status: 404 });
  return new Response(`${toRis(paper)}\n`, {
    headers: exportHeaders("application/x-research-info-systems", SHARED_CACHE_CONTROL, `${params.slug}.ris`),
  });
}
