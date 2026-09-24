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

/*
 * ONE SHEET, where there were three. blog-search.css is gone from this page rather than restyled:
 * its remaining rule is `.search-submit`, which is /search's filled button, and /search is its own
 * page with its own job. The listing's own field and word are in entry-list.css.
 *
 * evidence-row.css is imported HERE and not by the component, which is the house pattern:
 * every sheet a page loads is visible in the route's own imports.
 */
import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const env = getEnv(context);

  // Filter state lives in the URL and is applied in the query, so the HTML that
  // ships is already the filtered list rather than a client-side narrowing.
  const tag = url.searchParams.get("tag");
  const year = url.searchParams.get("year");
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;

  // INSTRUMENTATION, OFF BY DEFAULT. `?timing=1` opts in, and root's middleware is
  // what reads it and creates the collector for every route. This loader used to make
  // its own.
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();

  const [listing, tagList, yearList] = await timed(timings, "queries_all", () =>
    Promise.all([
      // ONE round trip now, not three. These two run in parallel with it and were
      // hidden underneath the old serial chain, so whether they are now the critical path
      // is the thing to read off the numbers rather than assume.
      listBlogPosts(env, { tag, year, page, perPage: POSTS_PER_PAGE, timings }),
      timed(timings, "d1_tag_list", () => listBlogTags(env)),
      timed(timings, "d1_year_list", () => listBlogYears(env)),
    ]),
  );

  /*
   * The featured post is surfaced only on the unfiltered first page, AND IT IS
   * REMOVED FROM THE LIST BELOW IT. Filtered here rather than in the component, so
   * the count the page reports and the items it renders come from one decision.
   *
   * PAGINATION IS UNAFFECTED: `pageCount` is computed over the whole corpus.
   *
   * KNOWN LIMIT: the hero only appears when the featured post falls on page 1.
   */
  const { featured, posts } = splitFeatured(
    listing.posts,
    !tag && !year && page === 1,
  );

  /*
   * OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE. NOT 404, because the resource
   * EXISTS and 404 would be wrong the moment enough posts make the page valid. NOT
   * CLAMPED IN PLACE, because the URL would then disagree with the page and a copied
   * link would be a lie. 302 rather than 301: the bound moves as posts are
   * published.
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
    // AFTER the spread, so the filtered array wins over `listing.posts`. Spread first
    // and this line is the whole fix; spread second and it is a no-op that reads like
    // one.
    posts,
    tags: tagList,
    years: yearList,
    activeTag: tag,
    activeYear: year,
    featured,
  };

  /*
   * The transport writes the header from the same array AFTER the handler returns,
   * which is the one point where it is complete. Stamping here would emit a header
   * built from a list still being written to.
   */
  return data(payload);
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  // The theme is a dimension of the cache key rather than a Vary, so this page no
  // longer declares one. Tagged `posts`, because its content is a function of the
  // corpus and a publish must be able to move it.
  const headers = new Headers(publicHtmlHeaders(cacheTags()));
  // Carried through from the loader. `headers` does not inherit them, so a
  // loader header that is not forwarded here simply never reaches the client.
  const timing = loaderHeaders.get("Server-Timing");
  if (timing) headers.set("Server-Timing", timing);
  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  /* The year names the page too. A reader with three `/blog` tabs open, one per
     year, otherwise sees three identical titles. */
  const filterLabel = [loaderData?.activeTag, loaderData?.activeYear]
    .filter(Boolean)
    .join(", ");
  const title = filterLabel ? `Blog: ${filterLabel} | ${SITE.name}` : `Blog | ${SITE.name}`;
  const description = "Writing on building for the web, mostly on Cloudflare.";
  /*
   * THE CANONICAL CARRIES EVERY AXIS THAT CHANGES THE LIST. Built from the same
   * axes `filterHref` uses, in the same order, so the canonical of a page is
   * byte-identical to the link that reaches it.
   */
  const canonicalParams = new URLSearchParams();
  if (loaderData?.activeTag) canonicalParams.set("tag", loaderData.activeTag);
  if (loaderData?.activeYear) canonicalParams.set("year", loaderData.activeYear);
  if (loaderData?.page && loaderData.page > 1) {
    canonicalParams.set("page", String(loaderData.page));
  }
  const canonicalQuery = canonicalParams.toString();

  /*
   * A TAG-ONLY FILTER CANONICALISES TO THE ARCHIVE, and ONLY when the tag is the
   * only filter: `?tag=x&year=2026` is a DIFFERENT list, so naming the archive would
   * point a crawler at a page whose content it does not share.
   */
  const tagOnly = Boolean(loaderData?.activeTag) && !loaderData?.activeYear;
  const path = tagOnly
    ? `${tagPath(loaderData!.activeTag!)}${
        loaderData?.page && loaderData.page > 1 ? `?page=${loaderData.page}` : ""
      }`
    : canonicalQuery
      ? `/blog?${canonicalQuery}`
      : "/blog";

  /*
   * `pageMeta` owns the social set. The two feed alternates moved to root's
   * `links`, which are merged onto every route, so nothing about this page is local
   * any more.
   */
  return pageMeta({ title, description, path });
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const { posts, tags, years, activeTag, activeYear, featured, page, pageCount, total, span } =
    loaderData;

  /**
   * EVERY link on this page, from one builder. The loader ANDs tag and year, so a
   * reader can be in both at once and a chip that knew only its own axis silently
   * destroyed the other. An override of `null` clears one axis.
   *
   * Page is dropped on any filter change: page 3 of one filter is not page 3 of
   * another, and carrying it would land a reader on an empty list their own click
   * created.
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
      {/*
       * THE h-feed IS THE `<main>` ITSELF, a deliberate refusal to add a wrapper: the
       * feed has to contain the head, the filters and the list, and those are siblings.
       *
       * NOT ON THE TAG ARCHIVE OR THE SERIES PAGE: a filtered view is not this blog's
       * feed.
       */}
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
          {/*
           * MEASURED, because the first version of this comment guessed and was wrong.
           * Implied properties are skipped for a root containing nested microformats, so the
           * class is not preventing a bad name, it is supplying the only one.
           */}
          <h1 className="list-label p-name">Blog</h1>
          <p className="list-dek">Writing on building for the web, mostly on Cloudflare.</p>
          {/* Three counted facts about THIS list, in the slot the evidence row takes on every
              page that carries one. Never typed; see `listingFacts`. */}
          <EvidenceRow facts={listingFacts(total, span)} />
        </header>

        {/*
         * Blog-scoped search is site search with type pinned, not a second engine: the
         * same index, parser and ranking serve both. A `<Form method="get">` emits the
         * same markup and URL as a plain form, so it works with scripting off.
         */}
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

        {/*
         * THE FILTERS ARE TEXT LINKS. They were 26 capsules with a filled --brand current state,
         * which is ruling 118 item 7's CHIP condition exactly; the state is weight and ink now,
         * and `aria-current` carries it into the accessibility tree either way. Still links, never
         * handlers: the URL is the state, with script or without it.
         */}
        {tags.length > 0 && (
          <nav className="list-filter" aria-label="Filter posts by tag">
            <span className="list-filter-label">Tags</span>
            {/* Clears the TAG and keeps the year, rather than clearing both. */}
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
            {/* Clears the YEAR and keeps the tag. */}
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

        {/*
         * THE FEATURED POST IS THE FIRST ROW OF THE LIST, not a well above it. `splitFeatured`
         * still removes it from the page's own array, so it appears once; what it no longer gets
         * is a bordered, rounded, filled box with a tracked-caps label on top, which was four of
         * ruling 117's kill list in one object. Being first, dated and marked is the whole claim.
         *
         * It is still an entry in the feed, which is why the feed is the `<main>`: a feed scoped
         * to the `<ul>` would have omitted it while it was a sibling, and `check:machine-readable`
         * counts the entries either way.
         */}
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
      {/*
       * NO BlogEnhancements HERE. Every one of that bundle's enhancements targets
       * markup the post pipeline renders inside `.prose`, and this page has none of it.
       * `check:browser` asserts on the resource timeline that it is not fetched here,
       * which is the half a source reading cannot give you.
       */}
    </>
  );
}
