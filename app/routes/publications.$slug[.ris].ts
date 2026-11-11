import { exportHeaders } from "~/lib/publications/export-response.mjs";
import { risOf } from "~/lib/publications/exports.mjs";
import { getEnv } from "~/lib/context";
import { publicationBySlug } from "~/lib/publications/by-slug";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.ris]";

export async function loader({ params, context }: Route.LoaderArgs) {
  const paper = await publicationBySlug(getEnv(context), params.slug);
  return new Response(`${risOf(paper)}\n`, {
    headers: exportHeaders(
      "application/x-research-info-systems",
      SHARED_CACHE_CONTROL,
      `${params.slug}.ris`,
    ),
  });
}
