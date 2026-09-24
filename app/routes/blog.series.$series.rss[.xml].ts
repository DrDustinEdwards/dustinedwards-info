import { data } from "react-router";

import { getBlogSeries, listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { Route } from "./+types/blog.series.$series.rss[.xml]";

/** Ordered by part, not date, and uncapped: a subscriber receives part one first and loses no later part. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const series = await getBlogSeries(env, params.series);
  if (!series) throw data("Not found", { status: 404 });

  const posts = await listBlogPostsRendered(env, { series: series.name, orderBy: "part" });

  const body = rssDocument({
    title: `${SITE.name} blog: ${series.name}`,
    link: `${SITE_ORIGIN}${seriesPath(series.name)}`,
    description: `Every part of ${series.name}, in order.`,
    selfUrl: `${SITE_ORIGIN}${seriesPath(series.name)}/rss.xml`,
    posts,
    origin: SITE_ORIGIN,
  });

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
