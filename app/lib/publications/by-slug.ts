import { getPublishedPublication } from "~/db/publications";
import type { Publication } from "~/lib/publications/types";

/**
 * The paper a `/research/publications/<slug>` URL names, or a thrown 404. Unfiltered by the showcase set:
 * excluding a record would give a page whose own export 404s. A draft answers as absent.
 */
export async function publicationBySlug(env: Env, slug: string | undefined): Promise<Publication> {
  const paper = slug ? await getPublishedPublication(env, slug) : null;
  if (!paper) throw new Response("Not found", { status: 404 });
  return paper;
}
