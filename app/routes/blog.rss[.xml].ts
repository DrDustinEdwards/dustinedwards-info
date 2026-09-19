import { listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.rss[.xml]";

/**
 * RSS 2.0, carrying the whole post.
 *
 * ONE FEED POLICY: both feeds read the same query with the same visibility predicate and the same
 * cap, and only the REPRESENTATION differs, markdown for the JSON consumer and rendered HTML for the
 * reader. Reads through listBlogPostsRendered, so publiclyVisible() applies on the same terms as the
 * index, and the cap is applied IN THE QUERY rather than by slicing a full read.
 *
 * The item markup is built by `rssItem`, where `node:test` can reach it, and that module is the one
 * owner of the XML escaping, so the two feeds' escaping can be compared.
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
