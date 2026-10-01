import { listPublishedPublications } from "~/db/publications";
import { getEnv } from "~/lib/context";
import { toBibtexAll } from "~/lib/publications/exports.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { exportHeaders, SHOWCASE_TYPES } from "~/lib/publications/export-response.mjs";
import type { Route } from "./+types/publications[.bib]";

/**
 * The showcase filter applies: an abstract beside its paper double-counts a work. No
 * `Content-Disposition: attachment`: people read citation files as often as they save them.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const papers = (await listPublishedPublications(getEnv(context))).filter((p) => SHOWCASE_TYPES.has(p.type));
  return new Response(toBibtexAll(papers), {
    headers: exportHeaders("application/x-bibtex", SHARED_CACHE_CONTROL, "publications.bib"),
  });
}
