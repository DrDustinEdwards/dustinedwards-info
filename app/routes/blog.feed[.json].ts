import { listBlogPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.feed[.json]";

/**
 * JSON Feed 1.1, alongside RSS.
 *
 * Reads through listBlogPosts, so publiclyVisible() applies on exactly the same
 * terms as the index and the RSS feed. `content_text` carries the markdown
 * source rather than the rendered HTML: a feed reader gets clean text, and an
 * agent gets the same bytes the .md twin serves.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { posts } = await listBlogPosts(getEnv(context), { perPage: 20 });

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE.name} blog`,
    home_page_url: `${SITE_ORIGIN}/blog`,
    feed_url: `${SITE_ORIGIN}/blog/feed.json`,
    description: "Writing on building for the web, mostly on Cloudflare.",
    language: "en-US",
    authors: [{ name: SITE.name, url: SITE_ORIGIN }],
    items: posts.map((post) => ({
      id: `${SITE_ORIGIN}/blog/${post.slug}`,
      url: `${SITE_ORIGIN}/blog/${post.slug}`,
      title: post.title,
      summary: post.description ?? undefined,
      date_published: post.publishAt
        ? new Date(post.publishAt).toISOString()
        : undefined,
      date_modified: post.updatedAt
        ? new Date(post.updatedAt).toISOString()
        : undefined,
      tags: post.tags.length > 0 ? post.tags : undefined,
      image: post.coverImage ? `${SITE_ORIGIN}${post.coverImage}` : undefined,
    })),
  };

  return new Response(`${JSON.stringify(feed, null, 2)}\n`, {
    headers: {
      "content-type": "application/feed+json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
