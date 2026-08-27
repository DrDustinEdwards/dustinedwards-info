import { Link, data } from "react-router";

import { BlogEnhancements } from "~/components/blog-enhancements";
import { BlogSpeculation } from "~/components/blog-speculation";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import {
  getBlogPost,
  getBlogPostMarkdown,
  listSeriesParts,
  publiclyVisibleSlugs,
} from "~/db";
import { blogPostView } from "~/lib/blog-view";
import { getEnv } from "~/lib/context";
import { longDateUTC } from "~/lib/long-date.mjs";
import { linkToMarkdown, markdownResponse, prefersMarkdown } from "~/lib/markdown-twin";
import {
  HTML_VARY_ACCEPT,
  NO_STORE_CACHE_CONTROL,
  SHARED_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  articleJsonLd,
  breadcrumbJsonLd,
  postSocial,
} from "~/lib/seo";
import type { Route } from "./+types/blog.$slug";

import "~/styles/blog-index.css";
import "~/styles/post-shell.css";
import "~/styles/prose.css";
import "~/styles/post-enhancements.css";

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
    /*
     * NEVER STORED, and the grounds are on `markdownResponse`. This is the
     * representation that shares a cache key with the HTML document, so a
     * stored copy here is the second variant that collapses the Cookie
     * dimension for both. The twin at its own URL is a different situation and
     * passes a different policy.
     */
    return markdownResponse(params.slug, post.body, NO_STORE_CACHE_CONTROL);
  },
];

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getBlogPost(getEnv(context), params.slug);
  if (!post) {
    throw data("Not found", { status: 404 });
  }

  const seriesParts = post.series
    ? await listSeriesParts(getEnv(context), post.series)
    : [];

  // The projection moved to `blogPostView` when /preview/:token landed, so the
  // two routes that render a post cannot drift in what they hand the component.
  // Output-neutral here by construction: this route's payload is unchanged.
  const view = blogPostView(post, seriesParts);

  /*
   * THE RELATED LIST IS RE-CHECKED AGAINST THE LIVE ROWS.
   *
   * `withRelated` composes the shared visibility rule at WRITE time, which is
   * where the scheduled-post leak was fixed. That is not enough on its own: the
   * list is stored on the row, and a post can be unpublished, or have its
   * publish date pushed out, after a list naming it has already been written.
   * Nothing rewrites its neighbours' related lists when that happens, so
   * without this the stale title and its URL keep rendering on a public page.
   *
   * One indexed query for the whole list, composing `publiclyVisible()` like
   * every other public read, so there is no second opinion about what public
   * means. It is the same instrument, and the same reasoning, as the Ask replay
   * path's citation re-check.
   */
  const stillPublic = await publiclyVisibleSlugs(
    getEnv(context),
    view.post.related.map((item) => item.slug),
  );

  return data(
    {
      ...view,
      post: {
        ...view.post,
        related: view.post.related.filter((item) => stillPublic.has(item.slug)),
      },
    },
    { headers: { Link: linkToMarkdown(post.slug) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers({
    // Publicly cacheable for COOKIELESS readers only; workers/app.ts downgrades
    // it when a cookie is present. Varies on Accept (the markdown twin) AND on
    // Cookie (the theme). Grounds on HTML_VARY in seo.ts.
    "Cache-Control": SHARED_CACHE_CONTROL,
    Vary: HTML_VARY_ACCEPT,
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
  // Built by `postSocial` and not here. The per-post social overrides, the
  // description fallback and the cover/card/mark precedence all moved into that
  // one function on 2026-08-02, when the editor gained SERP and social-card
  // previews: a preview whose job is to show what this route emits must not
  // compute it a second way, because the day the two disagree the preview lies
  // and nothing renders both at once to catch it.
  const { canonical, pageTitle, description, socialTitle, socialDescription, image } =
    postSocial(post);

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: socialTitle },
    { property: "og:description", content: socialDescription },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: socialTitle },
    { name: "twitter:description", content: socialDescription },
    /*
     * `twitter:image`, ADDED 2026-08-27. Without it this page declared
     * `summary_large_image` and gave the card nothing to put in it, which is
     * the same defect `pageMeta` was built to stop the other six pages
     * repeating: a card type and its image travel together or neither is worth
     * setting. The value is `postSocial`'s, so the cover/card/mark precedence
     * is stated once and this is not a second opinion about which image a post
     * has.
     */
    { name: "twitter:image", content: image },
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

/**
 * Shows a revision date only when it is meaningfully later than publication.
 *
 * The threshold is one day: a post synced the same day it was published has not
 * been revised, it has just been deployed. Without this every post would carry
 * an "Updated" line from the moment it shipped, which tells a reader nothing.
 */
const REVISED_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, toc, seriesParts } = loaderData;

  const published = post.publishAt ? new Date(post.publishAt).getTime() : null;
  const revised = post.updatedAt ? new Date(post.updatedAt).getTime() : null;
  const revisedLabel =
    published !== null && revised !== null && revised - published > REVISED_THRESHOLD_MS
      ? longDateUTC(post.updatedAt)
      : null;

  return (
    <>
      <SiteHeader />
      <main className="page" id="main">
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
                ogImage: post.ogImage,
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
                  {longDateUTC(post.publishAt)}
                </time>
              )}
              {post.readingTimeMinutes && <> · {post.readingTimeMinutes} min read</>}
              {revisedLabel && <> · Updated {revisedLabel}</>}
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

          {post.series && seriesParts.length > 1 && (
            <nav className="post-series" aria-labelledby="series-heading">
              <h2 id="series-heading">
                Part {post.part} of {seriesParts.length}: {post.series}
              </h2>
              <ol>
                {seriesParts.map((entry) => (
                  <li key={entry.slug} aria-current={entry.slug === post.slug ? "true" : undefined}>
                    {entry.slug === post.slug ? (
                      <span>{entry.title}</span>
                    ) : (
                      <Link to={`/blog/${entry.slug}`}>{entry.title}</Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

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

          {post.furtherReading.length > 0 && (
            <section className="further-reading" aria-labelledby="further-heading">
              <h2 id="further-heading">Further reading</h2>
              <ul>
                {post.furtherReading.map((item) => (
                  <li key={item.url}>
                    <a href={item.url} rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/*
            Agent actions. Every one is a plain link, so all three work with
            scripting off: the first navigates to the markdown twin, the other
            two open an assistant with the twin's URL in the prompt. The
            enhancement script upgrades the first to a clipboard copy.
          */}
          <nav className="post-actions" aria-label="Use this post elsewhere">
            <a
              className="post-action"
              href={`/blog/${post.slug}.md`}
              data-copy-markdown={`${SITE_ORIGIN}/blog/${post.slug}.md`}
            >
              Copy as Markdown
            </a>
            <a
              className="post-action"
              href={`https://claude.ai/new?q=${encodeURIComponent(
                `Read ${SITE_ORIGIN}/blog/${post.slug}.md and summarise it.`,
              )}`}
              rel="noopener noreferrer"
            >
              Open in Claude
            </a>
            <a
              className="post-action"
              href={`https://chatgpt.com/?q=${encodeURIComponent(
                `Read ${SITE_ORIGIN}/blog/${post.slug}.md and summarise it.`,
              )}`}
              rel="noopener noreferrer"
            >
              Open in ChatGPT
            </a>
          </nav>

          {/*
            ONE LINE, in the template, for every post. Ratified in
            colophon-page.md: not a section, and not per-article text. Twelve
            post footers each restating what the site runs on is twelve places
            to update and eleven that go stale, which is the rot the duplication
            rule exists to prevent, and they would compete with each other for
            the same search intent besides. The colophon carries the facts; a
            post carries a pointer to them.
          */}
          <p className="muted">
            Built on the stack described at <Link to="/colophon">/colophon</Link>.
          </p>
        </article>

        {post.related.length > 0 && (
          <section className="related-posts" aria-labelledby="related-heading">
            <h2 id="related-heading">Related posts</h2>
            <ul>
              {post.related.map((item) => (
                <li key={item.slug}>
                  <Link to={`/blog/${item.slug}`}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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
      <BlogEnhancements />
      <BlogSpeculation />
    </>
  );
}
