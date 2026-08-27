import { Form, Link, data, redirect } from "react-router";

import { BlogSpeculation } from "~/components/blog-speculation";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { listBlogPosts, listBlogTags, listBlogYears } from "~/db";
import { POSTS_PER_PAGE, splitFeatured } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { longDateUTC } from "~/lib/long-date.mjs";
import { serverTiming, timed, type Timings } from "~/lib/timing";
import {
  DEFAULT_OG_IMAGE,
  HTML_VARY,
  SHARED_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
  pageMeta,
} from "~/lib/seo";
import type { Route } from "./+types/blog._index";

import "~/styles/blog-search.css";
import "~/styles/blog-index.css";
import "~/styles/blog-index-extras.css";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const env = getEnv(context);

  // Filter state lives in the URL and is applied in the query, so the HTML that
  // ships is already the filtered list rather than a client-side narrowing.
  const tag = url.searchParams.get("tag");
  const year = url.searchParams.get("year");
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;

  // INSTRUMENTATION, OFF BY DEFAULT. `?timing=1` opts in.
  //
  // It shipped unconditionally during the measurement session, which put an
  // unratified header on every public response as a side effect of diagnosing
  // something. The problem was never that durations are sensitive; it is that
  // the next person to touch this loader could not tell whether anything
  // depended on that header. Behind a parameter it is a tool, not an API.
  const wantTiming = url.searchParams.get("timing") === "1";
  const timings: Timings | undefined = wantTiming ? [] : undefined;
  const loaderStart = performance.now();

  const [listing, tagList, yearList] = await timed(timings, "queries_all", () =>
    Promise.all([
      // ONE round trip now, not three: the tag lookup became a LEFT JOIN and
      // what remained went into a `db.batch`. These two run in parallel with
      // it and were entirely hidden underneath the old serial chain, so
      // whether they are now the critical path is the thing to read off the
      // numbers rather than assume.
      listBlogPosts(env, { tag, year, page, perPage: POSTS_PER_PAGE, timings }),
      timed(timings, "d1_tag_list", () => listBlogTags(env)),
      timed(timings, "d1_year_list", () => listBlogYears(env)),
    ]),
  );

  /*
   * The featured post is surfaced only on the unfiltered first page. Inside a
   * filter it would be noise.
   *
   * AND IT IS REMOVED FROM THE LIST BELOW IT, since 2026-08-21. The comment
   * that used to sit here ended "repeating it above a list it already appears
   * in reads as a duplicate", and then the code did exactly that: `featured` is
   * FOUND IN `listing.posts` and the list was rendered from the same array
   * unchanged, so the hero post appeared twice on /blog. The sentence was the
   * argument against the behaviour it introduced.
   *
   * Filtered HERE rather than in the component so the payload is already
   * correct, which also means the count the page reports and the items it
   * renders come from one decision instead of two.
   *
   * PAGINATION IS UNAFFECTED, and that is worth stating because it is the
   * obvious worry. `pageCount` is computed by the query over the whole corpus,
   * and page 2 is a separate offset query; removing one item from page 1's
   * rendered list does not shift anything into or out of page 2. Page 1 still
   * displays the same posts, one of them as the hero rather than as a row.
   *
   * KNOWN LIMIT, unchanged and now written down: the hero only appears when the
   * featured post happens to fall on page 1, because that is the only page this
   * loader has in hand. A featured post old enough to sit on page 3 is featured
   * nowhere.
   */
  const { featured, posts } = splitFeatured(
    listing.posts,
    !tag && !year && page === 1,
  );

  /*
   * OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE. Chosen over 404 and over
   * clamping in place, and the three differ in what they tell the reader.
   *
   * `/blog?page=99` rendered an empty list under the words "Page 99 of 3". The
   * list was honest and the sentence was not, and a crawler reading it sees a
   * soft 404: a 200 with no content, which is the shape search engines penalise
   * hardest because it cannot be distinguished from a real page.
   *
   * NOT 404, because the resource EXISTS. `/blog?tag=cloudflare` is a real
   * list; 99 is out of bounds for that list, not a missing document, and 404
   * would also be wrong the moment enough posts are published to make it valid.
   *
   * NOT CLAMPED IN PLACE, because the URL would then disagree with the page:
   * the address bar says 99 and the content is page 3, so a copied link is a
   * lie and the canonical would have to argue with its own URL.
   *
   * A REDIRECT fixes both. The reader lands on a page that exists, at the URL
   * that names it, and a crawler follows one hop to the canonical rather than
   * indexing an empty one. 302 rather than 301: the bound moves as posts are
   * published, so this is where page 99 goes TODAY, not forever.
   *
   * Page 0 and negatives fall out of the same clamp. The parse above already
   * turns junk into 1 via `|| 1`, so only numbers above the bound reach here.
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
    // AFTER the spread, so the filtered array wins over `listing.posts`. Spread
    // first and this line is the whole fix; spread second and it is a no-op
    // that reads like one.
    posts,
    tags: tagList,
    years: yearList,
    activeTag: tag,
    activeYear: year,
    featured,
  };

  /*
   * **THIS STAMP IS KEPT, AND IT IS THE ONLY ROUTE-LEVEL ONE LEFT.** The eleven
   * admin routes carried the same pair of lines and they were all removed,
   * because `workers/app.ts` writes the header from the SHARED array that the
   * admin middleware puts on `timingsContext`, with `set`, after the handler
   * returns. Overwritten by an identical value, on every one of them.
   *
   * That reasoning does not reach this route. The array on line 40 is LOCAL: no
   * middleware runs on the public plane, nothing sets `timingsContext`, and the
   * context's default is `{}`, so the transport reads `undefined` here and
   * stamps nothing. Removing these three lines would not tidy a duplicate, it
   * would delete the only Server-Timing the public plane emits.
   *
   * No header at all unless it was asked for, so the default response is
   * byte-identical to what it was before any of this instrumentation existed.
   */
  return timings
    ? data(payload, { headers: { "Server-Timing": serverTiming(timings) } })
    : data(payload);
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  // Publicly cacheable for COOKIELESS readers only. `workers/app.ts` downgrades
  // this to private, no-store whenever the request carries a cookie, so the only
  // variant ever stored is the themeless one. Grounds on HTML_VARY in seo.ts.
  const headers = new Headers({
    "Cache-Control": SHARED_CACHE_CONTROL,
    Vary: HTML_VARY,
  });
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
   * THE CANONICAL CARRIES EVERY AXIS THAT CHANGES THE LIST, which is all three.
   *
   * It carried `tag` alone, so `/blog?year=2026` and `/blog?page=2` each
   * declared `/blog` as their canonical. That tells a crawler those are the
   * same document as the unfiltered first page, which they are not: they are
   * different posts. The recorded consequence is thin-duplicate treatment, and
   * the actual one is worse, that the pages are asking to be dropped from the
   * index in favour of a page whose content they do not share.
   *
   * Built from the same axes `filterHref` uses, in the same order, so the
   * canonical of a page is byte-identical to the link that reaches it.
   */
  const canonicalParams = new URLSearchParams();
  if (loaderData?.activeTag) canonicalParams.set("tag", loaderData.activeTag);
  if (loaderData?.activeYear) canonicalParams.set("year", loaderData.activeYear);
  if (loaderData?.page && loaderData.page > 1) {
    canonicalParams.set("page", String(loaderData.page));
  }
  const canonicalQuery = canonicalParams.toString();
  const path = canonicalQuery ? `/blog?${canonicalQuery}` : "/blog";

  /*
   * THE SHARED BUILDER, plus the two feed links only this page has.
   *
   * The social half was a hand-written array here exactly as it was on five
   * other pages, and it had drifted the same way: no `twitter:image`, so the
   * card it declared rendered as a bare link. `pageMeta` owns the set and this
   * file adds what is genuinely local, which is the RSS and JSON feed
   * alternates.
   */
  return [
    ...pageMeta({ title, description, path }),
    {
      tagName: "link",
      rel: "alternate",
      type: "application/rss+xml",
      title: `${SITE.name} blog`,
      href: `${SITE_ORIGIN}/blog/rss.xml`,
    },
    {
      tagName: "link",
      rel: "alternate",
      type: "application/feed+json",
      title: `${SITE.name} blog`,
      href: `${SITE_ORIGIN}/blog/feed.json`,
    },
  ];
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const { posts, tags, years, activeTag, activeYear, featured, page, pageCount } =
    loaderData;

  /**
   * EVERY link on this page, from one builder.
   *
   * The loader composes tag AND year into a single query, so the two filters
   * are ANDed and a reader can legitimately be in both at once. The chips did
   * not know that: a tag chip linked to `/blog?tag=x` and a year chip to
   * `/blog?year=y`, so clicking either one silently DESTROYED the other. A
   * reader filtering to 2026 and then clicking a tag lost the year without
   * being told, and the chip they had just been using stopped being current.
   *
   * `pageHref` already knew how to preserve both and was the only link that
   * did. This generalises it rather than adding a second spelling: an override
   * of `null` clears one axis, which is what the All chips want, and every
   * other caller passes what it is changing.
   *
   * Page is dropped on any filter change, deliberately. Page 3 of one filter is
   * not page 3 of another, and carrying it would land a reader on an empty list
   * that their own click created.
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
      <main className="page" id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd(SITE_ORIGIN, [
                ["Home", "/"],
                ["Blog", "/blog"],
              ]),
            ),
          }}
        />

        <header className="page-head">
          <h1>Blog</h1>
          <p className="muted">Writing on building for the web, mostly on Cloudflare.</p>
        </header>

        {/* Blog-scoped search is site search with type pinned, not a second
            engine. The hidden field is what scopes it, so the same index, the
            same parser and the same ranking serve both, and a reader can widen
            to the whole site by removing one chip on the results page.

            A router `<Form method="get">`, which emits the same markup and the
            same URL as a plain form, so it still works with scripting off. The
            destination's own form (`search.tsx`) has always been a `<Form>`;
            these two now agree. */}
        <Form method="get" action="/search" role="search" className="blog-search">
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
          <nav className="tag-chips" aria-label="Filter posts by tag">
            {/* Clears the TAG and keeps the year, rather than clearing both. */}
            <Link
              to={filterHref({ tag: null })}
              className="tag-chip"
              aria-current={activeTag ? undefined : "true"}
            >
              All
            </Link>
            {tags.map((tag) => (
              <Link
                key={tag.slug}
                to={filterHref({ tag: tag.slug })}
                className="tag-chip"
                aria-current={activeTag === tag.slug ? "true" : undefined}
              >
                {tag.name} <span className="tag-count">{tag.total}</span>
              </Link>
            ))}
          </nav>
        )}

        {years.length > 1 && (
          <nav className="year-archive" aria-label="Filter posts by year">
            {/* Clears the YEAR and keeps the tag. */}
            <Link to={filterHref({ year: null })} aria-current={activeYear ? undefined : "true"}>
              All years
            </Link>
            {years.map((entry) => (
              <Link
                key={entry.year}
                to={filterHref({ year: String(entry.year) })}
                aria-current={activeYear === entry.year ? "true" : undefined}
              >
                {entry.year} <span className="tag-count">{entry.total}</span>
              </Link>
            ))}
          </nav>
        )}

        {featured && (
          <section className="featured-post" aria-labelledby="featured-heading">
            <p className="featured-label" id="featured-heading">
              Featured
            </p>
            <h2 className="post-card-title">
              <Link to={`/blog/${featured.slug}`}>{featured.title}</Link>
            </h2>
            {featured.description && <p>{featured.description}</p>}
          </section>
        )}

        {posts.length === 0 ? (
          <p className="muted">No posts here yet.</p>
        ) : (
          <ul className="post-list">
            {posts.map((post) => (
              <li key={post.slug} className="post-card">
                <h2 className="post-card-title">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="post-card-meta">
                  {post.publishAt && (
                    <time dateTime={new Date(post.publishAt).toISOString()}>
                      {longDateUTC(post.publishAt)}
                    </time>
                  )}
                  {post.readingTimeMinutes && (
                    <> · {post.readingTimeMinutes} min read</>
                  )}
                </p>
                {post.series && (
                  <p className="post-card-series">
                    {post.series}, part {post.part}
                  </p>
                )}
                {post.description && <p>{post.description}</p>}
                {post.tags.length > 0 && (
                  <p className="post-card-tags">
                    {post.tags.map((tag) => (
                      <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`}>
                        {tag}
                      </Link>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 && (
          <nav className="pagination" aria-label="Pagination">
            {page > 1 && <Link to={pageHref(page - 1)}>Newer</Link>}
            <span className="muted">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && <Link to={pageHref(page + 1)}>Older</Link>}
          </nav>
        )}
      </main>
      <SiteFooter />
      {/* NO BlogEnhancements HERE, since 2026-08-27. Every one of that bundle's
          seven enhancements targets markup the post PIPELINE renders inside
          `.prose`: the reading bar wants `.post .prose`, the scrollspy wants
          `.post-toc`, and the code buttons, heading links, footnote previews and
          lightbox all want elements that exist only inside a rendered post body.
          This page has none of them, so the bundle was 4,514 bytes downloaded and
          parsed to find nothing on the site's second most visited page.
          check:browser asserts on the resource timeline that it is not fetched
          here, which is the half a source reading cannot give you. */}
      <BlogSpeculation />
    </>
  );
}
