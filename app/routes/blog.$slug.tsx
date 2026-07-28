import { Link, data } from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { getBlogPost, getBlogPostMarkdown } from "~/db";
import { getEnv } from "~/lib/context";
import { linkToMarkdown, markdownResponse, prefersMarkdown } from "~/lib/markdown-twin";
import {
  PUBLIC_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  articleJsonLd,
  breadcrumbJsonLd,
} from "~/lib/seo";
import type { Route } from "./+types/blog.$slug";

/**
 * Content negotiation runs as middleware rather than in the loader.
 *
 * A document route's loader cannot return a raw Response: React Router hands it
 * to the component as `loaderData`, which 500s on the first property read.
 * Measured 2026-07-28, not assumed. Middleware is the layer that is allowed to
 * short-circuit with a Response, which is the same mechanism the /admin gate
 * uses.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, params, context }, next) => {
    if (!prefersMarkdown(request)) return next();

    // Same visibility gate as the HTML route, so a draft is not readable here.
    const post = await getBlogPostMarkdown(getEnv(context), params.slug);
    if (!post) return next();
    return markdownResponse(params.slug, post.body);
  },
];

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getBlogPost(getEnv(context), params.slug);
  if (!post) {
    throw data("Not found", { status: 404 });
  }

  /** @see drizzle/0003_post_toc.sql */
  let toc: Array<{ depth: number; id: string; text: string }> = [];
  if (post.toc) {
    try {
      toc = JSON.parse(post.toc);
    } catch {
      // A malformed toc costs the reader a contents list, not the page.
      toc = [];
    }
  }

  return data(
    {
    toc,
    post: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      html: post.html ?? "",
      publishAt: post.publishAt,
      updatedAt: post.updatedAt,
      coverImage: post.coverImage,
      coverAlt: post.coverAlt,
      readingTimeMinutes: post.readingTimeMinutes,
      tags: post.tags,
      previous: post.previous,
      next: post.next,
      },
    },
    { headers: { Link: linkToMarkdown(post.slug) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers({
    "Cache-Control": PUBLIC_CACHE_CONTROL,
    // The response body depends on Accept, so caches must key on it.
    Vary: "Accept",
  });
  const link = loaderHeaders.get("Link");
  if (link) headers.set("Link", link);
  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { post } = loaderData;
  const canonical = `${SITE_ORIGIN}/blog/${post.slug}`;
  const description = post.description ?? SITE.description;
  const image = post.coverImage ? `${SITE_ORIGIN}${post.coverImage}` : undefined;

  return [
    { title: `${post.title} | ${SITE.name}` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: post.title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonical },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: post.title },
    { name: "twitter:description", content: description },
    // The markdown twin, advertised so an agent can fetch source rather than
    // scrape the rendered page.
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${canonical}.md`,
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

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, toc } = loaderData;

  return (
    <>
      <SiteHeader />
      <main className="page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              articleJsonLd(SITE_ORIGIN, {
                slug: post.slug,
                title: post.title,
                description: post.description,
                publishAt: post.publishAt ? new Date(post.publishAt) : null,
                updatedAt: post.updatedAt ? new Date(post.updatedAt) : null,
                coverImage: post.coverImage,
                tags: post.tags,
              }),
              breadcrumbJsonLd(SITE_ORIGIN, [
                ["Home", "/"],
                ["Blog", "/blog"],
                [post.title, `/blog/${post.slug}`],
              ]),
            ]),
          }}
        />

        <article className="post">
          <header className="post-head">
            <h1>{post.title}</h1>
            <p className="post-card-meta">
              {post.publishAt && (
                <time dateTime={new Date(post.publishAt).toISOString()}>
                  {formatDate(post.publishAt)}
                </time>
              )}
              {post.readingTimeMinutes && <> · {post.readingTimeMinutes} min read</>}
            </p>
            {post.tags.length > 0 && (
              <p className="post-card-tags">
                {post.tags.map((tag) => (
                  <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`}>
                    {tag}
                  </Link>
                ))}
              </p>
            )}
          </header>

          {toc.length > 1 && (
            <nav className="post-toc" aria-labelledby="contents-heading">
              <h2 id="contents-heading">Contents</h2>
              <ol>
                {toc.map((entry) => (
                  <li key={entry.id} data-depth={entry.depth}>
                    <a href={`#${entry.id}`}>{entry.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/*
            The body is rendered at build time from markdown we author and is
            stored as HTML in D1. It contains no third-party input, which is why
            it can be injected directly.
          */}
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </article>

        <nav className="post-nav" aria-label="More posts">
          {post.previous && (
            <Link to={`/blog/${post.previous.slug}`} rel="prev">
              Previous: {post.previous.title}
            </Link>
          )}
          {post.next && (
            <Link to={`/blog/${post.next.slug}`} rel="next">
              Next: {post.next.title}
            </Link>
          )}
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}
