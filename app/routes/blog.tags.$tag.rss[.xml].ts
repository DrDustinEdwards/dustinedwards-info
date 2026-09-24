import { data } from "react-router";

import { getBlogTag, listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag.rss[.xml]";

/** 404 on an unknown tag: a feed and its page must agree about whether a tag exists. */
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
