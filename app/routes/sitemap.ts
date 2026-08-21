import { listBlogPosts, listPublicPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/sitemap";

/**
 * Static, always-present URLs: the hand-built pages that read typed data files
 * rather than `kind = 'page'` rows, so the D1 filter below cannot find them.
 *
 * ## DERIVED-BY-GATE, which is the ruling the old comment asked for
 *
 * This stayed a literal, and `check:invariants` section 14 now holds it against
 * `routes.ts`: every public page route must be listed here or exempted BY NAME
 * with a reason. So the list is still typed out, and it can no longer be
 * FORGOTTEN, which was the actual defect.
 *
 * Deriving the array at runtime was the other option and was rejected. The
 * route table is a build-time module of nested config objects, so reading it
 * here means either parsing TypeScript inside a Worker or shipping a second
 * generated artifact for four strings. The gate gets the same guarantee at no
 * runtime cost, and it can say WHY a route is absent, which a derivation cannot.
 *
 * FOUND BY THAT GATE, and it is why this comment changed: `/projects` and
 * `/playground` had been missing since they shipped. Both are public,
 * indexable, linked from the header nav, and absent from the sitemap. The old
 * comment predicted exactly this and left it, which is the shape the gate now
 * closes rather than notes.
 */
const STATIC_PATHS = [
  "/",
  "/blog",
  "/phage-discovery",
  "/colophon",
  "/projects",
  "/playground",
];

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
