import { data } from "react-router";

import { getBlogTag, listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag.rss[.xml]";

/**
 * One tag's RSS feed. The SAME document builder as `/blog/rss.xml`.
 *
 * Nothing about the channel, the namespaces or the item markup is restated
 * here: `rssDocument` owns all of it and `rssItem` owns the entries, so this
 * route is a query, a title and a self URL. A second feed that copied the
 * wrapper would be a second place the content namespace or the version string
 * could be wrong, and a feed reader is the last surface where that gets noticed.
 *
 * 404 ON AN UNKNOWN TAG, through `getBlogTag`, which is the page's own test.
 * A feed and its page must agree about whether a tag exists, or a subscriber
 * can hold a working feed URL for an archive that answers 404.
 */
const FEED_ITEMS = 20;

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });

  const posts = await listBlogPostsRendered(env, { perPage: FEED_ITEMS, tag: tag.slug });

  const body = rssDocument({
    title: `${SITE.name} blog: ${tag.name}`,
    link: `${SITE_ORIGIN}${tagPath(tag.slug)}`,
    description: `Posts tagged ${tag.name}.`,
    selfUrl: `${SITE_ORIGIN}${tagPath(tag.slug)}/rss.xml`,
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
