import { listBlogPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { PUBLIC_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/blog.rss[.xml]";

/** XML text escaping. Applied to every interpolated value without exception. */
function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  // Reads through listBlogPosts, so publiclyVisible() applies to the feed on
  // exactly the same terms as the index.
  const { posts } = await listBlogPosts(getEnv(context), { perPage: 20 });

  const items = posts
    .map((post) => {
      const url = `${origin}/blog/${post.slug}`;
      const published = post.publishAt ? new Date(post.publishAt).toUTCString() : null;
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        post.description
          ? `      <description>${escapeXml(post.description)}</description>`
          : null,
        published ? `      <pubDate>${published}</pubDate>` : null,
        ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE.name} blog`)}</title>
    <link>${escapeXml(`${origin}/blog`)}</link>
    <description>${escapeXml("Writing on building for the web, mostly on Cloudflare.")}</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(`${origin}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": PUBLIC_CACHE_CONTROL,
    },
  });
}
