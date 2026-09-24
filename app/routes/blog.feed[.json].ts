import { listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.feed[.json]";

const FEED_ITEMS = 20;

export async function loader({ context }: Route.LoaderArgs) {
  const posts = await listBlogPostsFullText(getEnv(context), { perPage: FEED_ITEMS });

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
       * `application/json`, not `application/feed+json`: Cloudflare does not compress `+json` types, and
       * this is the largest response on the site. Readers identify it by the `version` member.
       */
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
