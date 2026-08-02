import { listBlogPosts, listPublicPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/sitemap";

// Static, always-present URLs. /phage-discovery is a hand-built route reading a
// typed data file rather than a `kind = 'page'` row, so the D1 filter below
// cannot find it and it is listed here instead.
const STATIC_PATHS = ["/", "/blog", "/phage-discovery"];

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  const env = getEnv(context);

  const [rows, blog] = await Promise.all([
    listPublicPosts(env),
    // perPage is deliberately high: a sitemap lists everything rather than one
    // page of results. Both reads apply publiclyVisible().
    listBlogPosts(env, { perPage: 1000 }),
  ]);

  const urls = [
    ...STATIC_PATHS.map((path) => ({ loc: origin + path, lastmod: null as Date | null })),
    // Only `kind = 'page'` rows live at the root. Blog rows share this table and
    // are listed under /blog below, so filtering here is what stops every post
    // being emitted twice, once at a URL that does not exist.
    ...rows
      .filter((p) => p.kind === "page")
      .map((p) => ({
        loc: `${origin}/${p.slug}`,
        lastmod: p.updatedAt,
      })),
    ...blog.posts.map((p) => ({
      loc: `${origin}/blog/${p.slug}`,
      lastmod: p.updatedAt,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${
        u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""
      }</url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
