import { PUBLICATIONS, type Publication } from "~/data/publications";
import { doiSlug } from "~/lib/publications/paths.mjs";

/** Unfiltered by the showcase set: excluding a record would give a page whose own export 404s. */
const BY_SLUG = new Map<string, Publication>(PUBLICATIONS.map((p) => [doiSlug(p.doi), p]));

/** The paper a `/publications/<slug>` URL names, or a thrown 404. */
export function publicationBySlug(slug: string | undefined): Publication {
  const paper = BY_SLUG.get(slug ?? "");
  if (!paper) throw new Response("Not found", { status: 404 });
  return paper;
}
