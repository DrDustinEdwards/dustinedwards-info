import { listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.feed[.json]";

/**
 * JSON Feed 1.1, alongside RSS.
 *
 * Reads through listBlogPostsFullText, so publiclyVisible() applies on the same terms as the index,
 * the RSS feed and llms-full.txt. Each item is built by `feedItem`, where `node:test` asserts the
 * shape, because NO GATE CAN SEE A COMMENT DISAGREEING WITH A MAP THREE LINES UNDER IT.
 *
 * The cap is applied in the query rather than by slicing a full read.
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
       * `application/json`, NOT `application/feed+json`, and the reason is 160 KB.
       *
       * JSON Feed 1.1 says the content type SHOULD be `application/feed+json`. Cloudflare compresses a
       * fixed list of content types and `+json` suffixed types are not on it, so obeying the SHOULD made
       * the largest response on the site the only one shipping raw and uncompressed.
       *
       * Every reader identifies this document by the `version` member inside it, which is unchanged; the
       * content type is how it travels. Trading a SHOULD for what a subscriber actually downloads is the
       * right way round.
       */
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
