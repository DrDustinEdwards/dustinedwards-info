import { libraryTwin, libraryTwinHeaders } from "~/kb/library-twin.server";
import { baseCitation, baseMarkdown } from "~/kb/libraries.mjs";
import { SITE, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/kb-library[.md]";

/**
 * A knowledge base's library as markdown: the table of every published entry, drawn from the same rows as the page, and
 * how to download and cite it. Like the page, it is not there until the base has a published entry.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const twin = await libraryTwin(request, context, "md");
  if (twin instanceof Response) return twin;
  const { base, items } = twin;
  const citation = baseCitation(base, {
    name: SITE.name,
    affiliation: SITE.affiliation,
    origin: SITE_ORIGIN,
  });
  const body = [
    `# ${base.name}`,
    "",
    `## All ${base.name.toLowerCase()}`,
    "",
    baseMarkdown(base, items, SITE_ORIGIN),
    "",
    "## Download and cite",
    "",
    `- [CSV](${SITE_ORIGIN}${base.library}.csv): every entry with every fact the table shows; a filtered address gives the filtered rows`,
    `- [JSON](${SITE_ORIGIN}${base.library}.json): the same rows`,
    `- [Markdown](${SITE_ORIGIN}${base.library}.md): this page`,
    "",
    citation.library,
    "",
    citation.access,
    "",
    citation.protocol,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      ...libraryTwinHeaders(base, false),
    },
  });
}
