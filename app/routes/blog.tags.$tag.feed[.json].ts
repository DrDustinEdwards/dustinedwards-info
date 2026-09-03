import { data } from "react-router";

import { getBlogTag, listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag.feed[.json]";

/**
 * One tag's JSON feed, from `jsonFeedDocument`, the same envelope `/blog/feed.json`
 * uses.
 *
 * `application/json` rather than `application/feed+json`, which is the main
 * feed's ruling and is inherited rather than re-argued: Cloudflare compresses a
 * fixed list of content types and `+json` suffixes are not on it, so obeying
 * that SHOULD costs a subscriber the whole compression saving. The `version`
 * member inside the document is what every reader identifies it by.
 */
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
