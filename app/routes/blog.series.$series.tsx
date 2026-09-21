import { Link, data, redirect } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { PostRow, Pager } from "~/components/post-row";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { getBlogSeries, listSeriesPosts } from "~/db";
import { POSTS_PER_PAGE, listingFacts } from "~/lib/blog-listing.mjs";
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

// One sheet, where the card needed two: `.post-card-series` lived only in the extras sheet. The
// listing is one object now and an archive is the same object filtered.
import "~/styles/evidence-row.css";
import "~/styles/entry-list.css";

/**
 * The archive for one series.
 *
 * ORDERED BY PART, WHICH IS THE ONE LISTING THAT IS NOT NEWEST FIRST. A series is
 * the exception by construction: the author numbered the parts, and part one is
 * where you start. The feeds take the same order, so the page and the subscription
 * agree.
 *
 * 404 RATHER THAN AN EMPTY PAGE, the tag archive's rule inherited rather than
 * re-argued: an empty archive would be a soft 404 and would leak the existence of a
 * series only a draft carries.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;

  const series = await getBlogSeries(env, params.series);
  if (!series) throw data("Not found", { status: 404 });

  const listing = await listSeriesPosts(env, series.name, { page, perPage: POSTS_PER_PAGE });

  // Out of range redirects to the last real page, which is `/blog`'s ruling and
  // the tag archive's. 302, because the bound moves as parts are published.
  if (page > listing.pageCount) {
    const last = listing.pageCount > 1 ? `?page=${listing.pageCount}` : "";
    throw redirect(`${seriesPath(series.name)}${last}`);
  }

  return data({ ...listing, series });
}

export function headers() {
  // The tag archive's headers, through the same helper that owns them. This page
  // negotiates nothing, so it takes the helper rather than writing the pair out.
  return new Headers(publicHtmlHeaders(cacheTags()));
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { series, page } = loaderData;
  // `pageMeta` owns the complete social and canonical set, so this page cannot
  // ship a partial one. The canonical carries `?page=` when there is one, since page
  // two is different posts.
  const path = page > 1 ? `${seriesPath(series.name)}?page=${page}` : seriesPath(series.name);
  return pageMeta({
    title: `${series.name} | ${SITE.name}`,
    description: `Every part of ${series.name}, a series on ${SITE.name}'s blog.`,
    path,
  });
}

export default function BlogSeries({ loaderData }: Route.ComponentProps) {
  const { posts, series, page, pageCount, total, span } = loaderData;
  const base = seriesPath(series.name);
  const hrefFor = (n: number) => (n > 1 ? `${base}?page=${n}` : base);

  return (
    <>
      <SiteHeader />
      <main className="tracks list-tracks" id="main" tabIndex={-1}>
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

        <header className="list-head">
          <h1 className="list-label">{series.name}</h1>
          <p className="list-dek">
            A series in {series.total} part{series.total === 1 ? "" : "s"}, in order.{" "}
            <Link to="/blog">All posts</Link>
          </p>
          {/* The index's three counted facts, over this series' own list. */}
          <EvidenceRow facts={listingFacts(total, span)} />
        </header>

        {posts.length === 0 ? (
          <p className="list-empty">No posts here yet.</p>
        ) : (
          <ul className="entry-list">
            {posts.map((post) => (
              <PostRow key={post.slug} post={post} />
            ))}
          </ul>
        )}

        <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />

        {/*
         * The same offer the tag archive makes and for the same reason: a reader who wants one
         * series wants one series in their reader. Under the list, which is where a reader who
         * has decided to subscribe actually is.
         */}
        <p className="list-feeds">
          Subscribe: <a href={`${base}/rss.xml`}>RSS</a> <a href={`${base}/feed.json`}>JSON</a>
        </p>
      </main>
      <ShellFooter />
    </>
  );
}
