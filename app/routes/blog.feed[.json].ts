import { listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { feedItem } from "~/lib/json-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.feed[.json]";

/**
 * JSON Feed 1.1, alongside RSS.
 *
 * Reads through listBlogPostsFullText, so publiclyVisible() applies on exactly
 * the same terms as the index, the RSS feed and llms-full.txt. Each item is
 * built by `feedItem` in app/lib/json-feed.mjs, where `node:test` asserts the
 * shape: this file once promised `content_text` in a comment while the item
 * map emitted no content field at all, which JSON Feed 1.1 forbids, and no
 * gate could see a comment disagreeing with a map three lines under it.
 *
 * The cap is applied in the query, not by slicing a full read, because every
 * item now carries its whole markdown body.
 */
const FEED_ITEMS = 20;

export async function loader({ context }: Route.LoaderArgs) {
  const posts = await listBlogPostsFullText(getEnv(context), { perPage: FEED_ITEMS });

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE.name} blog`,
    home_page_url: `${SITE_ORIGIN}/blog`,
    feed_url: `${SITE_ORIGIN}/blog/feed.json`,
    description: "Writing on building for the web, mostly on Cloudflare.",
    language: "en-US",
    authors: [{ name: SITE.name, url: SITE_ORIGIN }],
    items: posts.map((post) => feedItem(post, SITE_ORIGIN)),
  };

  return new Response(`${JSON.stringify(feed, null, 2)}\n`, {
    headers: {
      "content-type": "application/feed+json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
