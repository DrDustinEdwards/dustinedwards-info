import { Link, data, redirect } from "react-router";

import { PostCard, Pagination } from "~/components/post-card";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { getBlogSeries, listSeriesPosts } from "~/db";
import { POSTS_PER_PAGE } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { jsonLd } from "~/lib/json-ld.mjs";
import {
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
  pageMeta,
  cacheTags,
  publicHtmlHeaders,
} from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { Route } from "./+types/blog.series.$series";

// Both sheets the shared card needs. `PostCard` renders `.post-card-series`,
// which lives only in the extras sheet; the tag archive learned this the hard
// way and the note is there.
import "~/styles/blog-index.css";
import "~/styles/blog-index-extras.css";

/**
 * The archive for one series.
 *
 * A post has carried `series` and `part` since the schema was written, the post
 * page has listed the other parts for just as long, and the set had no URL: a
 * reader arriving at part three from a search result could see that a series
 * existed and had nowhere to go for it. Section E's whole content.
 *
 * ## ORDERED BY PART, WHICH IS THE ONE LISTING THAT IS NOT NEWEST FIRST
 *
 * Every other list on this site is reverse chronological, because that is what
 * a reader wants from a blog. A series is the exception by construction: the
 * author numbered the parts, and part one is where you start. `listSeriesPosts`
 * orders ascending and the feeds take the same order, so the page and the
 * subscription agree.
 *
 * ## 404 RATHER THAN AN EMPTY PAGE
 *
 * `getBlogSeries` resolves through `listBlogSeries`, which composes
 * `isBlogPost()`. So a series carried only by drafts or by future-dated posts
 * does not exist here, which is the tag archive's rule inherited rather than
 * re-argued: an empty archive would be a soft 404 and would leak the existence
 * of a series only a draft carries.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;

  const series = await getBlogSeries(env, params.series);
  if (!series) throw data("Not found", { status: 404 });

  const listing = await listSeriesPosts(env, series.name, { page, perPage: POSTS_PER_PAGE });

  // Out of range redirects to the last real page, which is `/blog`'s ruling and
  // the tag archive's, inherited rather than restated. 302, because the bound
  // moves as parts are published.
  if (page > listing.pageCount) {
    const last = listing.pageCount > 1 ? `?page=${listing.pageCount}` : "";
    throw redirect(`${seriesPath(series.name)}${last}`);
  }

  return data({ ...listing, series });
}

export function headers() {
  // The tag archive's headers, through the same helper that owns them, which is
  // `SHARED_CACHE_CONTROL` with the `posts` cache tag. This page negotiates
  // nothing, so it
  // takes the helper rather than writing the pair out.
  return new Headers(publicHtmlHeaders(cacheTags()));
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { series, page } = loaderData;
  // `pageMeta` owns the complete social and canonical set, so this page cannot
  // ship a partial one. The canonical carries `?page=` when there is one, since
  // page two is different posts.
  const path = page > 1 ? `${seriesPath(series.name)}?page=${page}` : seriesPath(series.name);
  return pageMeta({
    title: `${series.name} | ${SITE.name}`,
    description: `Every part of ${series.name}, a series on ${SITE.name}'s blog.`,
    path,
  });
}

export default function BlogSeries({ loaderData }: Route.ComponentProps) {
  const { posts, series, page, pageCount } = loaderData;
  const base = seriesPath(series.name);
  const hrefFor = (n: number) => (n > 1 ? `${base}?page=${n}` : base);

  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbJsonLd(SITE_ORIGIN, [
                ["Home", "/"],
                ["Blog", "/blog"],
                [series.name, base],
              ]),
            ),
          }}
        />

        <header className="page-head">
          <h1>{series.name}</h1>
          <p className="muted">
            A series in {series.total} part{series.total === 1 ? "" : "s"}, in order.{" "}
            <Link to="/blog">All posts</Link>
          </p>
        </header>

        {/* The feeds for this series, as plain links, the same offer the tag
            archive makes and for the same reason: a reader who wants one series
            wants one series in their reader. */}
        <p className="muted">
          Subscribe: <a href={`${base}/rss.xml`}>RSS</a> <a href={`${base}/feed.json`}>JSON</a>
        </p>

        {posts.length === 0 ? (
          <p className="muted">No posts here yet.</p>
        ) : (
          <ul className="post-list">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </ul>
        )}

        <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
      </main>
      <ShellFooter />
    </>
  );
}
