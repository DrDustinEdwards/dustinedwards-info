import { getPublishedPageMarkdown } from "~/db/pages";
import { getEnv } from "~/lib/context";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

import type { Route } from "./+types/content-page[.md]";

/**
 * A page's markdown twin at `<page>.md`, compiled from the same file as the page
 * (app/lib/pages/compile.mjs), so an agent reads the facts a person does. Registered per listed path in
 * app/routes.ts, so a path with no page keeps answering through the splat's 404. Drafts answer 404.
 * It was a static file under public/ until the pages moved to D1 (docs/PAGES.md).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/\.md$/, "");
  const markdown = await getPublishedPageMarkdown(getEnv(context), path);
  if (markdown === null) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": CONTENT_PAGES_CACHE_TAG,
      // As every other page twin: the HTML page is the one to index.
      "x-robots-tag": "noindex",
      // Relative, as the static rule it replaced was: RFC 8288 resolves it against the request URL.
      link: `<${path}>; rel="canonical"`,
    },
  });
}
