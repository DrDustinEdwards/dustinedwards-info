import { Link, data } from "react-router";

import { BlogEnhancements } from "~/components/blog-enhancements";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import {
  approvedMentionsFor,
  getBlogPost,
  getBlogPostMarkdown,
  listSeriesParts,
  publiclyVisibleSlugs,
} from "~/db";
import { WEBMENTION_URL, linkToWebmention } from "~/lib/webmention/advertise";
import { safeHttpHref } from "~/lib/webmention/urls.mjs";
import { blogPostView } from "~/lib/blog-view";
import { jsonLd } from "~/lib/json-ld.mjs";
import { getEnv } from "~/lib/context";
import { longDateUTC } from "~/lib/long-date.mjs";
import { coverDimensions, coverResponsive } from "~/lib/cover-image.mjs";
import { seriesPath } from "~/lib/series-path.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
import { linkToMarkdown, markdownResponse, prefersMarkdown } from "~/lib/markdown-twin";
import {
  HTML_VARY_ACCEPT,
  NO_STORE_CACHE_CONTROL,
  cacheTags,
  SHARED_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  articleJsonLd,
  articleOpenGraph,
  breadcrumbJsonLd,
  postSocial,
} from "~/lib/seo";
import type { Route } from "./+types/blog.$slug";

import "~/styles/blog-index.css";
import "~/styles/post-shell.css";
import "~/styles/prose.css";
import "~/styles/post-enhancements.css";

/**
 * Content negotiation runs as middleware rather than in the loader: a document
 * route's loader cannot return a raw Response, because React Router hands it to
 * the component as `loaderData`. Middleware is the layer allowed to
 * short-circuit.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, params, context }, next) => {
    if (!prefersMarkdown(request)) return next();

    // Same visibility gate as the HTML route, so a draft is not readable here.
    const post = await getBlogPostMarkdown(getEnv(context), params.slug);
    if (!post) return next();
    /*
     * NEVER STORED. This representation shares a cache key with the HTML document,
     * so a stored copy here is the second variant that collapses the Cookie dimension
     * for both.
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

  // The projection lives in `blogPostView`, so the two routes that render a post
  // cannot drift in what they hand the component.
  const view = blogPostView(post, seriesParts);

  /*
   * THE RELATED LIST IS RE-CHECKED AGAINST THE LIVE ROWS. The list is stored on the
   * row, and a post can be unpublished after a list naming it was written, so
   * without this a stale title and URL keep rendering on a public page. One indexed
   * query composing `publiclyVisible()`, like every other public read, so there is
   * no second opinion about what public means.
   */
  const stillPublic = await publiclyVisibleSlugs(
    getEnv(context),
    view.post.related.map((item) => item.slug),
  );

  /*
   * READ HERE AND NOT IN `blogPostView`: `/preview/:token` shares that
   * projection, and a draft preview must not grow a mentions section. A 404 above
   * means this never runs.
   */
  const mentions = await approvedMentionsFor(getEnv(context), post.slug);

  return data(
    {
      ...view,
      mentions,
      post: {
        ...view.post,
        related: view.post.related.filter((item) => stillPublic.has(item.slug)),
      },
    },
    {
      /*
       * TWO VALUES IN ONE `Link`, comma-joined, which is how RFC 8288 spells a header
       * carrying more than one relation. Both are built from `SITE_ORIGIN`, so they
       * cannot come to name different hosts.
       */
      headers: {
        Link: [linkToMarkdown(post.slug), linkToWebmention()].join(", "),
        /*
         * THE CACHE TAG IS SET IN THE LOADER, and that is forced rather than chosen:
         * `HeadersArgs` carries no `params`, so the slug is not in scope down there.
         */
        "Cache-Tag": cacheTags(post.slug),
      },
    },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers({
    // The theme is a dimension of the cache KEY rather than a `Vary`. `Accept`
    // STAYS, because this URL really does serve a markdown representation too.
    //
    // TWO TAGS, and this is the only route with a per-document one.
    "Cache-Control": SHARED_CACHE_CONTROL,
    Vary: HTML_VARY_ACCEPT,
  });
  // Both carried through from the loader, which is the only place the slug is
  // in scope. A header the loader sets and this does not forward simply never
  // reaches the client.
  const link = loaderHeaders.get("Link");
  if (link) headers.set("Link", link);
  const tag = loaderHeaders.get("Cache-Tag");
  if (tag) headers.set("Cache-Tag", tag);
  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { post } = loaderData;
  // Built by `postSocial` and not here: a preview whose job is to show what this
  // route emits must not compute it a second way, because the day the two disagree
  // the preview lies.
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
     * A card type and its image travel together or neither is worth setting. The
     * value is `postSocial`'s, so this is not a second opinion about which image a
     * post has.
     */
    { name: "twitter:image", content: image },
    /*
     * Spread from `articleOpenGraph` rather than written out, so the four values
     * cannot come apart from `articleJsonLd`'s. `article:tag` repeats once per tag,
     * which is why this is a list.
     */
    ...articleOpenGraph(SITE_ORIGIN, {
      slug: post.slug,
      title: post.title,
      description: post.description,
      publishAt: post.publishAt ? new Date(post.publishAt) : null,
      updatedAt: post.updatedAt ? new Date(post.updatedAt) : null,
      coverImage: post.coverImage,
      ogImage: post.ogImage,
      tags: post.tags,
    }),
    // The markdown twin, advertised so an agent can fetch source rather than
    // scrape the rendered page.
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${canonical}.md`,
    },
    /*
     * A sender looks in two places and stops at the first, so both are emitted: one
     * that found only one would have to decide which this site meant.
     * `WEBMENTION_URL` is the constant the header is built from.
     */
    { tagName: "link", rel: "webmention", href: WEBMENTION_URL },
  ];
}

/**
 * The threshold is one day: a post synced the same day it was published has not
 * been revised, it has just been deployed. Without it every post would carry an
 * "Updated" line from the moment it shipped.
 */
const REVISED_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * THE ONE PLACE ON THIS PAGE WHERE THE TEXT IS NOT OURS.
 *
 * Every string in a mention was read out of a page this site does not control, so
 * it is RENDERED AS TEXT: React children, escaped by React, no
 * `dangerouslySetInnerHTML`, no image, and no source-supplied attribute except
 * one `href` that `safeHttpHref` has re-parsed.
 *
 * First-party markup is injected because we wrote it; third-party text is escaped
 * because we did not. Reading this as "the body is injected, so this could be too"
 * is the moment the rule is gone.
 *
 * @param mention one approved row, as `approvedMentionsFor` selected it
 */
function Mention({
  mention,
}: {
  mention: Route.ComponentProps["loaderData"]["mentions"][number];
}) {
  /*
   * The author's own URL first, the source page second, neither if neither parses.
   * A row whose URLs BOTH fail still renders as plain text: dropping it would hide
   * something the admin approved while the queue still showed it as published.
   */
  const href = safeHttpHref(mention.authorUrl) ?? safeHttpHref(mention.sourceUrl);

  /*
   * THE NAME FALLS BACK TO THE SOURCE URL, not to a word like "Someone": it
   * substitutes a FACT rather than a placeholder, which is hard rule 13's
   * distinction, in a spot where an invented value would be attributed to a real
   * person.
   */
  const name = mention.authorName ?? mention.sourceUrl;
  const decided = longDateUTC(mention.decidedAt);

  return (
    <li>
      {href ? (
        /*
         * `ugc` is what this link IS, `nofollow` is what it must not pass on, and the
         * other two are this site's default on every outbound anchor.
         */
        <a href={href} rel="nofollow ugc noopener noreferrer">
          {name}
        </a>
      ) : (
        <span>{name}</span>
      )}
      {mention.excerpt ? <p className="post-mention-excerpt">{mention.excerpt}</p> : null}
      {decided ? (
        <time className="post-mention-date" dateTime={new Date(mention.decidedAt!).toISOString()}>
          {decided}
        </time>
      ) : null}
    </li>
  );
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, toc, seriesParts, mentions } = loaderData;

  /*
   * ONE `postSocial` call, here rather than threaded through the loader, which
   * would be a third place the same rule could be stated. Pure, so calling it twice
   * cannot disagree with itself.
   */
  const { canonical, description: dek } = postSocial(post);

  /*
   * Derived from the list already on the page rather than queried: a second read
   * would be a second answer to what "the next part" means, and it would have to
   * agree with the list rendered beneath it.
   */
  const partIndex = seriesParts.findIndex((entry) => entry.slug === post.slug);
  const seriesPrevious = partIndex > 0 ? seriesParts[partIndex - 1] : undefined;
  const seriesNext =
    partIndex >= 0 && partIndex < seriesParts.length - 1
      ? seriesParts[partIndex + 1]
      : undefined;

  const published = post.publishAt ? new Date(post.publishAt).getTime() : null;
  const revised = post.updatedAt ? new Date(post.updatedAt).getTime() : null;
  const revisedLabel =
    published !== null && revised !== null && revised - published > REVISED_THRESHOLD_MS
      ? longDateUTC(post.updatedAt)
      : null;

  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
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

        {/*
         * Every microformats2 class here is a CLASS on markup that was already present.
         * Annotating the first copy cannot go out of step with itself, where a third copy
         * of the same facts would be a third thing to keep true. Ruling 50 as amended.
         */}
        <article className="post h-entry">
          <header className="post-head">
            <h1 className="p-name">{post.title}</h1>
            {/*
             * The SAME STRING the meta tag carries. `postSocial` falls back to the site
             * description where a post has none, so the raw column would put a different
             * sentence on the page than in the head.
             */}
            <p className="post-dek">{dek}</p>
            <p className="post-card-meta">
              {post.publishAt && (
                <time className="dt-published" dateTime={new Date(post.publishAt).toISOString()}>
                  {longDateUTC(post.publishAt)}
                </time>
              )}
              {post.readingTimeMinutes && <> · {post.readingTimeMinutes} min read</>}
              {/*
               * STILL CONDITIONAL, deliberately: a post nobody has revised has no updated date,
               * and emitting the row's `updatedAt` regardless would publish a sync timestamp as
               * if it were an edit.
               */}
              {revisedLabel && (
                <>
                  {" "}
                  · Updated{" "}
                  <time className="dt-updated" dateTime={new Date(post.updatedAt!).toISOString()}>
                    {revisedLabel}
                  </time>
                </>
              )}
            </p>
            {/*
             * `hidden` and not `.sr-only`: `.sr-only` is still announced, and a screen
             * reader gaining a name and a link on every post IS a change to the page. Every
             * mf2 parser reads the markup rather than the computed style.
             */}
            <p className="p-author h-card" hidden>
              <a className="p-name u-url" href="/">
                {SITE.name}
              </a>
            </p>
            {post.tags.length > 0 && (
              <p className="post-card-tags">
                {/* To the ARCHIVE, not to a filtered index. `tagPath` is the
                    one owner of that address; the chips on /blog keep pointing
                    at the filtered view because theirs composes with the year. */}
                {post.tags.map((tag) => (
                  <Link key={tag} to={tagPath(tag)}>
                    {tag}
                  </Link>
                ))}
              </p>
            )}
          </header>

          {/*
           * ABSENT, NOT EMPTY, when there is no cover: an empty figure is a landmark a
           * screen reader announces and a box the layout reserves, for nothing.
           *
           * EAGER AND HIGH PRIORITY, against the usual advice: this is the LCP element when
           * present, so lazy-loading it would defer the paint the metric measures.
           */}
          {post.coverImage && (
            <figure className="post-cover">
              <img
                src={post.coverImage}
                alt={post.coverAlt ?? ""}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                {...coverDimensions(post.coverImage)}
                {...coverResponsive(post.coverImage)}
              />
            </figure>
          )}

          {/*
           * THE LIST AND THE PAIR DO DIFFERENT JOBS: the ordered list is the table of
           * contents, the previous and next targets are the page turn and carry the LABEL so
           * direction can be read without counting.
           */}
          {post.series && seriesParts.length > 1 && (
            <nav className="post-series" aria-labelledby="series-heading">
              <h2 id="series-heading">
                Part {post.part} of {seriesParts.length}:{" "}
                <Link to={seriesPath(post.series)}>{post.series}</Link>
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
              {(seriesPrevious || seriesNext) && (
                <div className="post-series-steps">
                  {seriesPrevious && (
                    <Link className="post-nav-target" to={`/blog/${seriesPrevious.slug}`}>
                      <span className="post-nav-label">Previous part</span>
                      <span className="post-nav-title">{seriesPrevious.title}</span>
                    </Link>
                  )}
                  {seriesNext && (
                    <Link className="post-nav-target" to={`/blog/${seriesNext.slug}`}>
                      <span className="post-nav-label">Next part</span>
                      <span className="post-nav-title">{seriesNext.title}</span>
                    </Link>
                  )}
                </div>
              )}
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
            className="prose e-content"
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
           * Every one is a plain link, so all three work with scripting off. The
           * enhancement script upgrades the first to a clipboard copy.
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
           * THE PERMALINK IS THE COPY-LINK, and it needs no script at all. A clipboard
           * button does nothing for a reader without JavaScript and looks identical to one
           * that works; an anchor is visible, focusable, right-clickable and long-pressable.
           * NO enhancement is registered for it.
           */}
          <nav className="post-actions post-share" aria-label="Share this post">
            {/*
             * The permalink is also the h-entry's `u-url`: this anchor already holds the
             * canonical absolute URL, it is visible, and it is the one a reader copies. One
             * element for a consumer and a human.
             */}
            <a className="post-action u-url" href={canonical}>
              Permalink
            </a>
            <a
              className="post-action"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                canonical,
              )}`}
              rel="noopener noreferrer"
            >
              Share on LinkedIn
            </a>
            <a
              className="post-action"
              href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(
                canonical,
              )}`}
            >
              Share by email
            </a>
          </nav>

          {/*
           * ABSENT, NOT EMPTY: an empty section is a landmark a screen reader announces and
           * a heading a reader scrolls to, for nothing. The escaping grounds are on the
           * `Mention` component.
           */}
          {mentions.length > 0 && (
            <section className="post-mentions" aria-labelledby="mentions-heading">
              <h2 id="mentions-heading">Mentions</h2>
              <ul>
                {mentions.map((mention) => (
                  <Mention key={mention.id} mention={mention} />
                ))}
              </ul>
            </section>
          )}

          {/*
           * ONE LINE, in the template. The colophon carries the facts; a post carries a
           * pointer to them, because twelve post footers restating them is eleven that go
           * stale.
           */}
          <p className="muted">
            Built on the stack described at <Link to="/colophon">/colophon</Link>.
          </p>
        </article>

        {post.related.length > 0 && (
          <section className="related-posts" aria-labelledby="related-heading">
            <h2 id="related-heading">Related posts</h2>
            <ul>
              {/*
               * Rendered only when the row HAS one: rows written before the field existed carry
               * no description, so this degrades to the title rather than to an empty paragraph.
               * The ranking above is untouched.
               */}
              {post.related.map((item) => (
                <li key={item.slug}>
                  <Link to={`/blog/${item.slug}`}>{item.title}</Link>
                  {item.description ? (
                    <span className="related-description">{item.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
         * Each is a bordered block carrying the label above the title, which gives it a
         * real 24px-plus target on touch and lets direction be read before the title. NO
         * IMAGE, deliberately: a thumbnail here would be a third image on a page that
         * already has a cover and a card. `rel="prev"` and `rel="next"` are the
         * machine-readable half and are kept.
         */}
        <nav className="post-nav" aria-label="More posts">
          {post.previous && (
            <Link className="post-nav-target" to={`/blog/${post.previous.slug}`} rel="prev">
              <span className="post-nav-label">Previous</span>
              <span className="post-nav-title">{post.previous.title}</span>
            </Link>
          )}
          {post.next && (
            <Link className="post-nav-target" to={`/blog/${post.next.slug}`} rel="next">
              <span className="post-nav-label">Next</span>
              <span className="post-nav-title">{post.next.title}</span>
            </Link>
          )}
        </nav>
      </main>
      <ShellFooter />
      <BlogEnhancements />
    </>
  );
}
