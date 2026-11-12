import { getEnv } from "~/lib/context";
import {
  EDGE_CACHE_HEADER,
  SHARED_CACHE_CONTROL,
  SITE_ORIGIN,
  scheduledEdgeCacheControl,
} from "~/lib/seo";
import { SITE_URLS_CACHE_TAGS, gatherSiteUrls } from "~/lib/site-urls.server";
import { sitemapResponse } from "@drdustinedwards/site-helpers/sitemap";
import type { Route } from "./+types/sitemap";

/**
 * Every public URL, from the one list the site map page (/site-map) also reads (app/lib/site-urls.server.ts),
 * so the two cannot drift. What is listed, and where each `lastmod` comes from, is said there. The files it
 * lists that are not pages (the CV's PDF) come from there too.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { urls, files, nextPublishAt } = await gatherSiteUrls(getEnv(context));
  return sitemapResponse(
    [
      ...urls.map((url) => ({
        loc: SITE_ORIGIN + url.path,
        lastmod: url.lastmod,
        images: url.images?.map((src) => SITE_ORIGIN + src),
      })),
      ...files.map((file) => ({ loc: SITE_ORIGIN + file.path, lastmod: file.lastmod })),
    ],
    {
      headers: {
        /* No `Vary`: this document embeds no reader state. */
        "cache-control": SHARED_CACHE_CONTROL,
        /* Lists posts, tags, series, procedures, the prose pages and the registry, so all four purges must reach it. */
        "cache-tag": SITE_URLS_CACHE_TAGS,
        [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt),
      },
    },
  );
}
