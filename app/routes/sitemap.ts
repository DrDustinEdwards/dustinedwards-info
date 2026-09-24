import { listBlogPosts, listBlogSeries, listBlogTags } from "~/db";
import { getEnv } from "~/lib/context";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
import { PUBLICATIONS } from "~/data/publications";
import { doiSlug, paperPath } from "~/lib/publications/paths.mjs";
import type { Route } from "./+types/sitemap";

/**
 * Kept in step with `routes.ts` by hand: every public page route is listed here or exempted by name
 * with a reason.
 */
const STATIC_PATHS = [
  "/",
  "/about",
  "/blog",
  "/phage-discovery",
  "/publications",
  "/colophon",
  "/projects",
  "/playground",
  "/playground/ui",
  "/privacy",
];

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  const env = getEnv(context);

  /* No `kind = 'page'` read: both writers into `posts` write only 'post'. Recheck that before relying on it. */
  /* No `lastmod`: a tag has no modification date of its own. */
  const [blog, tagList, seriesList] = await Promise.all([
    listBlogPosts(env, { perPage: 1000 }),
    listBlogTags(env),
    listBlogSeries(env),
  ]);

  const urls = [
    ...STATIC_PATHS.map((path) => ({ loc: origin + path, lastmod: null as Date | null })),
    /*
     * No `lastmod`: one commit date would mark every paper changed together, which teaches crawlers to
     * ignore the field. No showcase filter: a crawler has no double-counting problem.
     */
    ...PUBLICATIONS.map((p) => ({
      loc: `${origin}${paperPath(doiSlug(p.doi))}`,
      lastmod: null as Date | null,
    })),
    ...blog.posts.map((p) => ({
      loc: `${origin}/blog/${p.slug}`,
      lastmod: p.updatedAt,
    })),
    ...tagList.map((t) => ({
      loc: `${origin}${tagPath(t.slug)}`,
      lastmod: null as Date | null,
    })),
    ...seriesList.flatMap((row) =>
      row.name === null
        ? []
        : [{ loc: `${origin}${seriesPath(row.name)}`, lastmod: null as Date | null }],
    ),
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
      /* No `Vary`: this document embeds no reader state. */
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
