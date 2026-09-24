import { listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.rss[.xml]";

const FEED_ITEMS = 20;

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  const posts = await listBlogPostsRendered(getEnv(context), { perPage: FEED_ITEMS });

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
