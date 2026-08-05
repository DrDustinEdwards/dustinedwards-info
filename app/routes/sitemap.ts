import { listBlogPosts, listPublicPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/sitemap";

// Static, always-present URLs. /phage-discovery and /colophon are hand-built
// routes reading typed data files rather than `kind = 'page'` rows, so the D1
// filter below cannot find them and they are listed here instead.
//
// NOTED, NOT FIXED: this is a hardcoded list MIRRORING routes.ts, which is the
// shape check:invariants exists to prevent. A public page added there and
// forgotten here is simply absent from the sitemap, silently, and nothing
// fails. Deriving it needs a rule for which routes are indexable, since
// /search is deliberately noindex and the resource routes are not pages at
// all, and that is a ruling rather than a refactor.
const STATIC_PATHS = ["/", "/blog", "/phage-discovery", "/colophon"];

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
