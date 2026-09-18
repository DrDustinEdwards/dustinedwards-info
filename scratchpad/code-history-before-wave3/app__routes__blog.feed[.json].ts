import { listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
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

  /*
   * THE SHARED ENVELOPE, since the tag feeds landed. `feedItem` was already
   * shared and this object was not, so a second JSON feed would have copied the
   * version URL, the language and the authors array. The `version` member is
   * the one every reader identifies the document by, and the one a copy would
   * most quietly get wrong.
   */
  const feed = jsonFeedDocument({
    title: `${SITE.name} blog`,
    homePageUrl: `${SITE_ORIGIN}/blog`,
    feedUrl: `${SITE_ORIGIN}/blog/feed.json`,
    description: "Writing on building for the web, mostly on Cloudflare.",
    authorName: SITE.name,
    posts,
    origin: SITE_ORIGIN,
  });

  return new Response(`${JSON.stringify(feed, null, 2)}\n`, {
    headers: {
      /*
       * `application/json`, NOT `application/feed+json`, and the reason is
       * 160 KB.
       *
       * JSON Feed 1.1 says the content type SHOULD be `application/feed+json`.
       * It is a SHOULD, and this is what obeying it cost, measured on
       * production 2026-08-27 with `Accept-Encoding: br, gzip`:
       *
       *     /blog/rss.xml    application/rss+xml    Content-Encoding: br
       *     /blog/feed.json  application/feed+json  none, 160,577 bytes
       *
       * Cloudflare compresses a fixed list of content types and `+json`
       * suffixed types are not on it, so the largest response on the site was
       * the only one shipping raw. Every reader identifies this document by the
       * `version` member inside it, which is unchanged; the content type is how
       * it travels. Trading a SHOULD for what a subscriber actually downloads
       * is the right way round.
       */
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
