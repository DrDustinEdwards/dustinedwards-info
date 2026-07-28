import { Link } from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { listBlogPosts, listBlogTags } from "~/db";
import { getEnv } from "~/lib/context";
import { PUBLIC_CACHE_CONTROL, SITE, breadcrumbJsonLd } from "~/lib/seo";
import type { Route } from "./+types/blog._index";

const PER_PAGE = 10;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const env = getEnv(context);

  // Filter state lives in the URL and is applied in the query, so the HTML that
  // ships is already the filtered list rather than a client-side narrowing.
  const tag = url.searchParams.get("tag");
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;

  const [listing, tagList] = await Promise.all([
    listBlogPosts(env, { tag, page, perPage: PER_PAGE }),
    listBlogTags(env),
  ]);

  return {
    ...listing,
    tags: tagList,
    activeTag: tag,
    origin: url.origin,
  };
}

export function headers() {
  return { "Cache-Control": PUBLIC_CACHE_CONTROL };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.activeTag
    ? `Blog: ${loaderData.activeTag} | ${SITE.name}`
    : `Blog | ${SITE.name}`;
  const description = "Writing on building for the web, mostly on Cloudflare.";
  const canonical = loaderData?.activeTag
    ? `${loaderData.origin}/blog?tag=${encodeURIComponent(loaderData.activeTag)}`
    : `${loaderData?.origin ?? ""}/blog`;

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { name: "twitter:card", content: "summary" },
    {
      tagName: "link",
      rel: "alternate",
      type: "application/rss+xml",
      title: `${SITE.name} blog`,
      href: `${loaderData?.origin ?? ""}/blog/rss.xml`,
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
  const { posts, tags, activeTag, page, pageCount, origin } = loaderData;

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (activeTag) params.set("tag", activeTag);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  return (
    <>
      <SiteHeader />
      <main className="page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd(origin, [
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
    </>
  );
}
