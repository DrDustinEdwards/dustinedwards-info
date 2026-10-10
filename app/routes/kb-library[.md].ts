import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { baseAtLibrary, baseCitation, baseItems, baseMarkdown } from "~/kb/libraries.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/kb-library[.md]";

const notFound = () => new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * A knowledge base's library as markdown: the table of every published entry, drawn from the same rows as the page, and
 * how to download and cite it. Like the page, it is not there until the base has a published entry.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const base = baseAtLibrary(new URL(request.url).pathname.replace(/\.md$/, ""));
  if (!base) return notFound();
  const items = baseItems(base, await listPublishedRecordsOfProfile(getEnv(context), base.profile));
  if (items.length === 0) return notFound();
  const citation = baseCitation(base, { name: SITE.name, affiliation: SITE.affiliation, origin: SITE_ORIGIN });
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
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      "x-robots-tag": "noindex",
      link: canonicalLink(base.library),
    },
  });
}
