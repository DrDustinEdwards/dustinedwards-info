import { getPublishedPublicationMarkdown } from "~/db/publications";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { PUBLICATIONS_CACHE_TAG, paperPath } from "~/lib/publications/paths.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/publications.$slug[.md]";

/**
 * A paper's markdown twin at `/research/publications/<slug>.md`, read from the same row as its page
 * (app/lib/publications/twin.mjs builds it), so an agent reads the facts a person does and an edit through
 * Carrel reaches both at once. A draft answers 404 like its page.
 *
 * It was a static asset until publications moved to D1, which is why its headers lived in public/_headers.
 * They are here now, with the cache tag a save purges. NOINDEX because a paper page is a Scholar submission
 * and a second indexable URL with the same title and abstract is the duplicate that costs it its ranking;
 * the twin is for agents, and llms.txt is where they are told about it. The canonical link names the page.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const slug = params.slug;
  const markdown = slug ? await getPublishedPublicationMarkdown(getEnv(context), slug) : null;
  if (markdown === null) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PUBLICATIONS_CACHE_TAG,
      "x-robots-tag": "noindex",
      link: canonicalLink(paperPath(slug as string)),
    },
  });
}
