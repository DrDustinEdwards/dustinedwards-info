import { listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.rss[.xml]";

/**
 * RSS 2.0, and since 2026-08-28 it carries the whole post.
 *
 * ONE FEED POLICY. The JSON feed has served full content since it shipped and
 * this one served a one-line description, so the same corpus reached a
 * subscriber differently depending on which URL they happened to paste. Both
 * now read the same query with the same visibility predicate and the same cap;
 * only the REPRESENTATION differs, markdown for the JSON consumer and rendered
 * HTML for the reader, and `app/lib/rss-feed.mjs` says why.
 *
 * Reads through listBlogPostsRendered, so publiclyVisible() applies to the feed
 * on exactly the same terms as the index. The cap is applied IN THE QUERY, not
 * by slicing a full read, because every item now carries a rendered body.
 *
 * The item markup is built by `rssItem`, where `node:test` can reach it,
 * exactly as `feedItem` is for the JSON feed. That module is also the one owner
 * of the XML escaping, which used to live here and in nothing else, so the two
 * feeds' escaping could not be compared.
 */
const FEED_ITEMS = 20;

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  const posts = await listBlogPostsRendered(getEnv(context), { perPage: FEED_ITEMS });

  /*
   * THE SHARED DOCUMENT BUILDER, since the tag feeds landed. The channel used
   * to be a template literal here, which made it the one part of the feed a
   * second feed would have had to copy.
   */
  const body = rssDocument({
    title: `${SITE.name} blog`,
    link: `${origin}/blog`,
    description: "Writing on building for the web, mostly on Cloudflare.",
    selfUrl: `${origin}/blog/rss.xml`,
    posts,
    origin,
  });

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
