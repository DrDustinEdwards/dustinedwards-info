import { getPublishedProcedureMarkdown, listPublishedLibraryRecords } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { libraryItems, workflowContext, workflowMarkdown } from "~/lib/procedures/library.mjs";
import { PROCEDURES_CACHE_TAG } from "~/lib/procedures/route";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/procedure[.md]";

/**
 * A procedure's markdown twin at `<page>.md`, generated from the same file as the page
 * (app/lib/procedures/render.mjs), so an agent reads the facts a person does. Drafts answer 404.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/\.md$/, "");
  const env = getEnv(context);
  const stored = await getPublishedProcedureMarkdown(env, path);
  if (stored === null) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  // A protocol's place in the phage workflow depends on the other protocols, so it is added here, not stored in the row.
  const workflow = workflowMarkdown(workflowContext(libraryItems(await listPublishedLibraryRecords(env)), path), SITE_ORIGIN);
  const markdown = workflow ? `${stored.trimEnd()}

${workflow}
` : stored;
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      // As every other page twin (public/_headers): the HTML page is the one to index.
      "x-robots-tag": "noindex",
      link: canonicalLink(path),
    },
  });
}
