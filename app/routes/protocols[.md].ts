import { getPublishedPageMarkdown } from "~/db/pages";
import { listPublishedLibraryRecords } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { LIBRARY_PATH, citeMarkdown, libraryCitation, libraryItems, libraryMarkdown, libraryOverview, overviewMarkdown } from "~/lib/procedures/library.mjs";
import { PROCEDURES_CACHE_TAG } from "~/lib/procedures/route";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/protocols[.md]";

/**
 * The library's markdown twin: the page's own introduction, then the table of every protocol, drawn from the same
 * records as the catalog, so an agent reads the facts a person does. The page's markdown comes from its D1 row and
 * the table from the procedures, so a protocol saved appears here with no deploy.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const intro = await getPublishedPageMarkdown(env, LIBRARY_PATH);
  if (intro === null) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const items = libraryItems(await listPublishedLibraryRecords(env));
  const citation = libraryCitation({ name: SITE.name, affiliation: SITE.affiliation, origin: SITE_ORIGIN });
  const body =
    `${intro.trimEnd()}\n\n${overviewMarkdown(libraryOverview(items), SITE_ORIGIN)}\n\n` +
    `## All protocols\n\n${libraryMarkdown(items, SITE_ORIGIN)}\n\n${citeMarkdown(citation, SITE_ORIGIN)}\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": `${CONTENT_PAGES_CACHE_TAG},${PROCEDURES_CACHE_TAG}`,
      "x-robots-tag": "noindex",
      link: canonicalLink(LIBRARY_PATH),
    },
  });
}
