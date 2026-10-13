import { getEnv } from "~/lib/context";
import { EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL, SITE_ORIGIN, scheduledEdgeCacheControl } from "~/lib/seo";
import { SITE_URLS_CACHE_TAGS, gatherSiteUrls } from "~/lib/site-urls.server";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import type { Route } from "./+types/sitemap";

/**
 * Every public URL, from the one list the site map page (/site-map) also reads (app/lib/site-urls.server.ts),
 * so the two cannot drift. What is listed, and why some entries carry no `lastmod`, is said there.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { urls, nextPublishAt } = await gatherSiteUrls(getEnv(context));
  const body = sitemapDocument(urls.map((url) => ({ loc: SITE_ORIGIN + url.path, lastmod: url.lastmod })));

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      /* No `Vary`: this document embeds no reader state. */
      "cache-control": SHARED_CACHE_CONTROL,
      /* Lists posts, tags, series, procedures, the prose pages and the registry, so all four purges must reach it. */
      "cache-tag": SITE_URLS_CACHE_TAGS,
      [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt),
    },
  });
}
