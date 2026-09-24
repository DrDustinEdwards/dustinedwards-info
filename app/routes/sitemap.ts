import { listBlogPosts, listBlogSeries, listBlogTags } from "~/db";
import { getEnv } from "~/lib/context";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
import { PUBLICATIONS } from "~/data/publications";
import { doiSlug, paperPath } from "~/lib/publications/paths.mjs";
import type { Route } from "./+types/sitemap";

/**
 * Static, always-present URLs: the hand-built pages that read typed data files rather than
 * `kind = 'page'` rows, so the D1 filter below cannot find them.
 *
 * The list stays a literal, kept in step with `routes.ts` by hand: every public page route must be
 * listed here or exempted BY NAME with a reason. A
 * runtime derivation would cost a second generated artifact and could not say WHY a route is absent.
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

  /*
   * ONE READ. The second was `listPublicPosts`, filtered to `kind = 'page'` rows, and NO SUCH ROW CAN
   * EXIST: both writers into `posts` hardcode the literal `'post'`, and rule 18 makes
   * `renderAndWrite` the one door to a rendered row.
   *
   * The writers still write only 'post'. Deleting a dead branch is only safe while the thing that
   * made it dead is still true, so recheck that before relying on it.
   */
  /*
   * TAGS RIDE ALONG. `listBlogTags` is the SAME read the chip list makes and it composes
   * `isBlogPost()`, so a tag carried only by drafts or by future-dated posts is absent here for
   * exactly the reason its archive answers 404. A second predicate would be a second answer to which
   * tags are public, and the one that disagreed would be the one nobody tested.
   *
   * NO `lastmod`: a tag has no modification date of its own, and deriving one from its newest post
   * would be a claim this read cannot support.
   */
  const [blog, tagList, seriesList] = await Promise.all([
    listBlogPosts(env, { perPage: 1000 }),
    listBlogTags(env),
    listBlogSeries(env),
  ]);

  const urls = [
    ...STATIC_PATHS.map((path) => ({ loc: origin + path, lastmod: null as Date | null })),
    /*
     * ONE ENTRY PER PAPER, from the committed corpus rather than a query: `publications.ts` is
     * generated, gated and committed, so these are as reproducible as the static paths and need no read.
     *
     * NO `lastmod`, deliberately. The file's commit date would mark every paper as changing together
     * whenever the registry refresh touches one field, and a lastmod that moves for unrelated reasons
     * teaches a crawler to stop believing the field.
     *
     * The SHOWCASE filter is NOT applied here: the index hides conference abstracts to spare a reader
     * the same work twice, a crawler has no such problem, and a page that exists and is absent from the
     * sitemap is a gap.
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
       * THE SAME CONSTANT THE FEEDS USE, which the Renderer pairs with the edge policy, so a delete
       * converges on the same schedule and the same purge as `blog.rss[.xml].ts` and
       * `blog.feed[.json].ts`, which list the same posts from the same projection. A local `max-age` with
       * no `Vary` was not bustable by a cookie either.
       *
       * NO `Vary`, and that is correct rather than an omission: this document embeds no reader state.
       * `HTML_VARY` exists for routes that put the theme in `<html data-theme>`, which is where rule 8
       * requires the pairing.
       */
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
