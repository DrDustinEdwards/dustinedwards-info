import { Form, Link, data, redirect } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { PostRow, Pager } from "~/components/post-row";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { listBlogPosts, listBlogTags, listBlogYears } from "~/db";
import { POSTS_PER_PAGE, listingFacts, splitFeatured } from "~/lib/blog-listing.mjs";
import { jsonLd } from "~/lib/json-ld.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
import { getEnv } from "~/lib/context";
import { timed, timingsContext } from "~/lib/timing";
import {
  cacheTags,
  publicHtmlHeaders,
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
  pageMeta,
} from "~/lib/seo";
import type { Route } from "./+types/blog._index";

/* evidence-row.css is imported here, not by the component: every sheet a page loads shows in its route's imports. */
import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const env = getEnv(context);

  const tag = url.searchParams.get("tag");
  const year = url.searchParams.get("year");
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;

  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();

  const [listing, tagList, yearList] = await timed(timings, "queries_all", () =>
    Promise.all([
      listBlogPosts(env, { tag, year, page, perPage: POSTS_PER_PAGE, timings }),
      timed(timings, "d1_tag_list", () => listBlogTags(env)),
      timed(timings, "d1_year_list", () => listBlogYears(env)),
    ]),
  );

  /*
   * Filtered here so the reported count and the rendered items come from one decision.
   * Known limit: the hero only appears when the featured post falls on page 1.
   */
  const { featured, posts } = splitFeatured(
    listing.posts,
    !tag && !year && page === 1,
  );

  /*
   * Out of range redirects to the last real page: a 404 would be wrong once posts arrive, and
   * clamping in place would make the URL lie. 302 because the bound moves.
   */
  if (page > listing.pageCount) {
    const target = new URLSearchParams();
    if (tag) target.set("tag", tag);
    if (year) target.set("year", year);
    if (listing.pageCount > 1) target.set("page", String(listing.pageCount));
    const qs = target.toString();
    throw redirect(qs ? `/blog?${qs}` : "/blog");
  }

  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });

  const payload = {
    ...listing,
    // After the spread, so the filtered array wins over `listing.posts`.
    posts,
    tags: tagList,
    years: yearList,
    activeTag: tag,
    activeYear: year,
    featured,
  };

  /* The transport writes the header from this array after the handler returns, when it is complete. */
  return data(payload);
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  // Tagged `posts`: a publish must be able to move this page.
  const headers = new Headers(publicHtmlHeaders(cacheTags()));
  // `headers` does not inherit loader headers, so one not forwarded here never reaches the client.
  const timing = loaderHeaders.get("Server-Timing");
  if (timing) headers.set("Server-Timing", timing);
  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const filterLabel = [loaderData?.activeTag, loaderData?.activeYear]
    .filter(Boolean)
    .join(", ");
  const title = filterLabel ? `Blog: ${filterLabel} | ${SITE.name}` : `Blog | ${SITE.name}`;
  const description = "Writing on building for the web, mostly on Cloudflare.";
  /* Built from the same axes as `filterHref`, in order, so the canonical is byte-identical to the link. */
  const canonicalParams = new URLSearchParams();
  if (loaderData?.activeTag) canonicalParams.set("tag", loaderData.activeTag);
  if (loaderData?.activeYear) canonicalParams.set("year", loaderData.activeYear);
  if (loaderData?.page && loaderData.page > 1) {
    canonicalParams.set("page", String(loaderData.page));
  }
  const canonicalQuery = canonicalParams.toString();

  /* Only when the tag is the only filter: `?tag=x&year=2026` is a different list. */
  const tagOnly = Boolean(loaderData?.activeTag) && !loaderData?.activeYear;
  const path = tagOnly
    ? `${tagPath(loaderData!.activeTag!)}${
        loaderData?.page && loaderData.page > 1 ? `?page=${loaderData.page}` : ""
      }`
    : canonicalQuery
      ? `/blog?${canonicalQuery}`
      : "/blog";

  return pageMeta({ title, description, path });
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const { posts, tags, years, activeTag, activeYear, featured, page, pageCount, total, span } =
    loaderData;

  /**
   * Every link from one builder: tag and year AND together, so a chip that knew one axis destroyed
   * the other. Page is dropped on any filter change.
   */
  const filterHref = (
    override: { tag?: string | null; year?: string | null; page?: number } = {},
  ) => {
    const params = new URLSearchParams();
    const tag = "tag" in override ? override.tag : activeTag;
    const year = "year" in override ? override.year : activeYear;
    if (tag) params.set("tag", tag);
    if (year) params.set("year", year);
    if (override.page && override.page > 1) params.set("page", String(override.page));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  const pageHref = (n: number) => filterHref({ page: n });

  return (
    <>
      <SiteHeader />
      {/* The h-feed is `<main>` itself: head, filters and list are siblings. Not on archives: a filtered view is not this blog's feed. */}
      <main className="tracks list-tracks h-feed" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbJsonLd(SITE_ORIGIN, [
                ["Home", "/"],
                ["Blog", "/blog"],
              ]),
            ),
          }}
        />

        <header className="list-head">
          {/* Implied properties are skipped for a root containing nested microformats, so this class supplies the only name. */}
          <h1 className="list-label p-name">Blog</h1>
          <p className="list-dek">Writing on building for the web, mostly on Cloudflare.</p>
          <EvidenceRow facts={listingFacts(total, span)} />
        </header>

        <Form method="get" action="/search" role="search" className="list-search">
          <label className="sr-only" htmlFor="blog-search-input">
            Search the blog
          </label>
          <input
            type="search"
            id="blog-search-input"
            name="q"
            placeholder="Search the blog"
            autoComplete="off"
          />
          <input type="hidden" name="type" value="post" />
          <button type="submit">Search</button>
        </Form>

        {tags.length > 0 && (
          <nav className="list-filter" aria-label="Filter posts by tag">
            <span className="list-filter-label">Tags</span>
            <Link to={filterHref({ tag: null })} aria-current={activeTag ? undefined : "true"}>
              All
            </Link>
            {tags.map((tag) => (
              <Link
                key={tag.slug}
                to={filterHref({ tag: tag.slug })}
                aria-current={activeTag === tag.slug ? "true" : undefined}
              >
                {tag.name} <span className="filter-count">{tag.total}</span>
              </Link>
            ))}
          </nav>
        )}

        {years.length > 1 && (
          <nav className="list-filter" aria-label="Filter posts by year">
            <span className="list-filter-label">Years</span>
            <Link to={filterHref({ year: null })} aria-current={activeYear ? undefined : "true"}>
              All
            </Link>
            {years.map((entry) => (
              <Link
                key={entry.year}
                to={filterHref({ year: String(entry.year) })}
                aria-current={activeYear === entry.year ? "true" : undefined}
              >
                {entry.year} <span className="filter-count">{entry.total}</span>
              </Link>
            ))}
          </nav>
        )}

        {posts.length === 0 && !featured ? (
          <p className="list-empty">No posts here yet.</p>
        ) : (
          <ul className="entry-list">
            {featured && <PostRow post={featured} mark="Featured" />}
            {posts.map((post) => (
              <PostRow key={post.slug} post={post} />
            ))}
          </ul>
        )}

        <Pager page={page} pageCount={pageCount} hrefFor={pageHref} />
      </main>
      <ShellFooter />
      {/* No <Enhance module="blog" />: its enhancements target `.prose` markup, which this page has none of. */}
    </>
  );
}
