import { data } from "react-router";

import { getBlogSeries, listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { Route } from "./+types/blog.series.$series.feed[.json]";

/** `application/json`, not `application/feed+json`: Cloudflare does not compress `+json` suffixes. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const series = await getBlogSeries(env, params.series);
  if (!series) throw data("Not found", { status: 404 });

  const posts = await listBlogPostsFullText(env, { series: series.name, orderBy: "part" });

  const feed = jsonFeedDocument({
    title: `${SITE.name} blog: ${series.name}`,
    homePageUrl: `${SITE_ORIGIN}${seriesPath(series.name)}`,
    feedUrl: `${SITE_ORIGIN}${seriesPath(series.name)}/feed.json`,
    description: `Every part of ${series.name}, in order.`,
    authorName: SITE.name,
    posts,
    origin: SITE_ORIGIN,
  });

  return new Response(`${JSON.stringify(feed, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
