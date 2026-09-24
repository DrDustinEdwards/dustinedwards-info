import { listBlogPostsRendered } from "~/db";
import { getEnv } from "~/lib/context";
import { atomDocument } from "~/lib/atom-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.atom[.xml]";

const FEED_ITEMS = 20;

export async function loader({ context }: Route.LoaderArgs) {
  const posts = await listBlogPostsRendered(getEnv(context), { perPage: FEED_ITEMS });

  const body = atomDocument({
    title: `${SITE.name} blog`,
    subtitle: "Writing on building for the web, mostly on Cloudflare.",
    alternateUrl: `${SITE_ORIGIN}/blog`,
    selfUrl: `${SITE_ORIGIN}/blog/atom.xml`,
    authorName: SITE.name,
    posts,
    origin: SITE_ORIGIN,
  });

  return new Response(body, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
