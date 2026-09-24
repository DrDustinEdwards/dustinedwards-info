import { data } from "react-router";

import { getBlogTag, listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag.feed[.json]";

/** `application/json`, not `application/feed+json`: Cloudflare does not compress `+json` suffixes. */
const FEED_ITEMS = 20;

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });

  const posts = await listBlogPostsFullText(env, { perPage: FEED_ITEMS, tag: tag.slug });

  const feed = jsonFeedDocument({
    title: `${SITE.name} blog: ${tag.name}`,
    homePageUrl: `${SITE_ORIGIN}${tagPath(tag.slug)}`,
    feedUrl: `${SITE_ORIGIN}${tagPath(tag.slug)}/feed.json`,
    description: `Posts tagged ${tag.name}.`,
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
