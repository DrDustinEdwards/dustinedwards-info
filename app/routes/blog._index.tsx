import { Link, data } from "react-router";

import { BlogEnhancements } from "~/components/blog-enhancements";
import { BlogSpeculation } from "~/components/blog-speculation";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { listBlogPosts, listBlogTags, listBlogYears } from "~/db";
import { POSTS_PER_PAGE } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { serverTiming, timed, type Timings } from "~/lib/timing";
import {
  DEFAULT_OG_IMAGE,
  HTML_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
} from "~/lib/seo";
import type { Route } from "./+types/blog._index";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const env = getEnv(context);

  // Filter state lives in the URL and is applied in the query, so the HTML that
  // ships is already the filtered list rather than a client-side narrowing.
  const tag = url.searchParams.get("tag");
  const year = url.searchParams.get("year");
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;

  // INSTRUMENTATION, reported as Server-Timing. Measurement only: nothing here
  // changes what the loader returns or how it queries. `/blog` measured 276ms
  // p50 against 35ms for `/`, and the cause was suspected rather than known.
  const timings: Timings = [];
  const loaderStart = performance.now();

  const [listing, tagList, yearList] = await timed(timings, "queries_all", () =>
    Promise.all([
      // Already parallel with the two below. The three ROUND TRIPS this one
      // makes internally are not parallel with each other, which is the
      // distinction the numbers have to settle.
      listBlogPosts(env, { tag, year, page, perPage: POSTS_PER_PAGE, timings }),
      timed(timings, "d1_tag_list", () => listBlogTags(env)),
      timed(timings, "d1_year_list", () => listBlogYears(env)),
    ]),
  );

  // The featured post is surfaced only on the unfiltered first page. Inside a
  // filter it would be noise, and repeating it above a list it already appears
  // in reads as a duplicate.
  const featured =
    !tag && !year && page === 1
      ? (listing.posts.find((post) => post.featured) ?? null)
      : null;

  timings.push({ name: "loader_total", ms: performance.now() - loaderStart });

  return data(
    {
      ...listing,
      tags: tagList,
      years: yearList,
      activeTag: tag,
      activeYear: year,
      featured,
    },
    { headers: { "Server-Timing": serverTiming(timings) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  // HTML embeds the reader's theme, so it is never shared-cached. Grounds on
  // HTML_CACHE_CONTROL in seo.ts.
  const headers = new Headers({ "Cache-Control": HTML_CACHE_CONTROL });
  // Carried through from the loader. `headers` does not inherit them, so a
  // loader header that is not forwarded here simply never reaches the client.
  const timing = loaderHeaders.get("Server-Timing");
  if (timing) headers.set("Server-Timing", timing);
  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.activeTag
    ? `Blog: ${loaderData.activeTag} | ${SITE.name}`
    : `Blog | ${SITE.name}`;
  const description = "Writing on building for the web, mostly on Cloudflare.";
  const canonical = loaderData?.activeTag
    ? `${SITE_ORIGIN}/blog?tag=${encodeURIComponent(loaderData.activeTag)}`
    : `${SITE_ORIGIN}/blog`;

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { property: "og:image", content: DEFAULT_OG_IMAGE },
    { name: "twitter:card", content: "summary_large_image" },
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

function formatDate(value: string | Date | null) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const { posts, tags, years, activeTag, activeYear, featured, page, pageCount } =
    loaderData;

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (activeTag) params.set("tag", activeTag);
    if (activeYear) params.set("year", activeYear);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

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
            to the whole site by removing one chip on the results page. A plain
            GET form: it works with scripting off. */}
        <form method="get" action="/search" role="search" className="blog-search">
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
        </form>

        {tags.length > 0 && (
          <nav className="tag-chips" aria-label="Filter posts by tag">
            <Link
              to="/blog"
              className="tag-chip"
              aria-current={activeTag ? undefined : "true"}
            >
              All
            </Link>
            {tags.map((tag) => (
              <Link
                key={tag.slug}
                to={`/blog?tag=${encodeURIComponent(tag.slug)}`}
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
            <Link to="/blog" aria-current={activeYear ? undefined : "true"}>
              All years
            </Link>
            {years.map((entry) => (
              <Link
                key={entry.year}
                to={`/blog?year=${entry.year}`}
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
                      {formatDate(post.publishAt)}
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
      <BlogEnhancements />
      <BlogSpeculation />
    </>
  );
}
