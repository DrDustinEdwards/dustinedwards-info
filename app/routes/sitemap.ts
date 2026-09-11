import { listBlogPosts, listBlogSeries, listBlogTags } from "~/db";
import { getEnv } from "~/lib/context";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
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
  "/about",
  "/blog",
  "/phage-discovery",
  "/colophon",
  "/projects",
  "/playground",
  "/privacy",
];

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  const env = getEnv(context);

  /*
   * ONE READ, since 2026-08-28. It was two.
   *
   * The second was `listPublicPosts`, filtered below to `kind = 'page'` rows.
   * NO SUCH ROW CAN EXIST: both writers into `posts` hardcode the literal
   * `'post'` for that column, the Worker's in `publish.server.ts` and the
   * build's in `sync-content.mjs`, and rule 18 makes `renderAndWrite` the one
   * door to a rendered row. Measured against the live database on 2026-08-28:
   * twelve rows, all `post`, no `page`.
   *
   * So the filter was a branch nothing could reach, paid for with a D1 read on
   * every crawl. `check:invariants` section 14 asserts the writers still write
   * only 'post', because deleting a dead branch is only safe while the thing
   * that made it dead is still true.
   *
   * The root-level pages are STATIC_PATHS above, which the same section holds
   * against the route table.
   */
  /*
   * TAGS RIDE ALONG, since the archives landed.
   *
   * `listBlogTags` is the SAME read the chip list makes and it composes
   * `isBlogPost()`, so a tag carried only by drafts or by future-dated posts is
   * absent from this list for exactly the reason its archive answers 404. That
   * is the visibility rule the spec asks for, and it is inherited rather than
   * restated: a second predicate here would be a second answer to which tags
   * are public, and the one that disagreed would be the one nobody tested.
   *
   * NO `lastmod`. A tag has no modification date of its own, and deriving one
   * from its newest post would be a claim this read cannot support: the tag
   * list carries counts, not dates, and fetching dates for it would be a second
   * query to state something a crawler treats as a hint anyway.
   */
  const [blog, tagList, seriesList] = await Promise.all([
    listBlogPosts(env, { perPage: 1000 }),
    listBlogTags(env),
    listBlogSeries(env),
  ]);

  const urls = [
    ...STATIC_PATHS.map((path) => ({ loc: origin + path, lastmod: null as Date | null })),
    ...blog.posts.map((p) => ({
      loc: `${origin}/blog/${p.slug}`,
      lastmod: p.updatedAt,
    })),
    ...tagList.map((t) => ({
      loc: `${origin}${tagPath(t.slug)}`,
      lastmod: null as Date | null,
    })),
    /*
     * SERIES ARCHIVES, on the tag archives' terms. `listBlogSeries` composes
     * `isBlogPost()`, so a series carried only by drafts or by future-dated
     * posts is absent here for the same reason its archive answers 404. No
     * `lastmod`, for the same reason a tag has none: the list carries counts,
     * not dates, and inventing one from the newest part would be a claim this
     * read cannot support.
     */
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
      /*
       * THE SAME CONSTANT THE FEEDS USE, since 2026-09-02. It was
       * `public, max-age=3600`, written here rather than imported, and that
       * hour was the longest any public surface held a post after it was gone.
       *
       * Measured on the image-path test post: deleted, and the sitemap still
       * listed it while `/blog/<slug>` answered 404 and both feeds had already
       * dropped it. `max-age` with no `Vary` is not bustable by a cookie
       * either, so even a signed-in reload served the stale copy.
       *
       * The shared constant is `s-maxage`, which is the SHARED cache only, plus
       * `stale-while-revalidate`. So the browser revalidates, the edge holds it
       * for ten minutes rather than sixty, and a delete converges on the same
       * schedule as `blog.rss[.xml].ts` and `blog.feed[.json].ts`, which list
       * exactly the same posts from exactly the same projection.
       *
       * NO `Vary`, and that is correct rather than an omission: this document
       * embeds no reader state. `HTML_VARY` exists for routes that put the
       * theme in `<html data-theme>`, and pairing it with this constant is what
       * rule 8 requires THERE. An XML listing of public URLs has no such half.
       */
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
