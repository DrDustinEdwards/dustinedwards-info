import { data } from "react-router";

import { getBlogSeries, listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { Route } from "./+types/blog.series.$series.rss[.xml]";

/**
 * One series' RSS feed, through `rssDocument`, the builder the blog feed and
 * the tag feeds already use. Nothing about the channel, the namespaces or the
 * item markup is restated here.
 *
 * ORDERED BY PART, not by date, which is the one way this differs from every
 * other feed on the site and is the whole point of a series: a subscriber
 * should receive part one first. `listBlogPostsRendered` takes the order from
 * its caller for exactly this case.
 *
 * NO CAP. The other feeds take the newest twenty because a blog is unbounded; a
 * series is a finite thing an author numbered, and truncating it would drop the
 * later parts, which are the ones a reader following along has not read.
 *
 * 404 ON AN UNKNOWN SERIES, through `getBlogSeries`, which is the page's own
 * test: a feed and its page must agree about whether a series exists.
 */
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
