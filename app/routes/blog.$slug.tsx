import { Link, data } from "react-router";

import { BlogEnhancements } from "~/components/blog-enhancements";
import { SiteFooter } from "~/components/site-footer";
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
import { CONTENT_SIZES, contentSrcSet } from "~/lib/media/widths.mjs";
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

  /*
   * THE APPROVED MENTIONS, READ HERE AND NOT IN `blogPostView`.
   *
   * `/preview/:token` shares that projection, and a draft preview must not grow
   * a mentions section: the projection's whole claim is that a reviewer sees
   * what a reader would see, and a draft has no readers and therefore no
   * approved mentions to see. Putting the read in the projection would also put
   * a second D1 query on every preview render to return an empty array every
   * time. So it sits beside the view rather than inside it, which is the one
   * place these two routes are allowed to differ.
   *
   * AFTER the post resolves, which is not merely ordering: a 404 above means
   * this never runs, and `approvedMentionsFor` composes `publiclyVisible()`
   * itself besides. Both halves are stated on that function.
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
       * TWO VALUES IN ONE `Link`, comma-joined, which is how RFC 8288 spells a
       * header carrying more than one relation. The markdown twin has been here
       * since the twin shipped; the webmention endpoint joins it because a
       * sender reads discovery out of this header before it parses anything.
       *
       * Both are built by a named function from `SITE_ORIGIN`, so the two
       * values cannot come to name different hosts.
       */
      headers: {
        Link: [linkToMarkdown(post.slug), linkToWebmention()].join(", "),
        /*
         * THE CACHE TAG IS SET IN THE LOADER, not in `headers()`, and that is
         * forced rather than chosen: `HeadersArgs` carries `loaderHeaders` and
         * no `params`, so the slug is not in scope down there. The loader is
         * where the post is known, so it is where the tag is built, and
         * `headers()` forwards it exactly as it forwards `Link`.
         */
        "Cache-Tag": cacheTags(post.slug),
      },
    },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers({
    // Publicly cacheable for EVERY reader since 2026-09-05: the theme is a
    // dimension of the cache key rather than a Vary. `Accept` STAYS, because
    // this URL really does serve a markdown representation as well as HTML.
    //
    // TWO TAGS, and this is the only route that gets a per-document one.
    // Approving a mention on THIS post purges `post:<slug>` and nothing else;
    // a publish purges `posts` and moves every page that lists the corpus,
    // this one included. Grounds on cacheTags in seo.ts.
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
    /*
     * THE `article:*` PROPERTIES, from the same inputs the JSON-LD below uses.
     *
     * `og:type` has said "article" since this page existed and nothing said
     * anything about the article: a crawler reading Open Graph and not JSON-LD
     * saw a typed article with no date, no author and no tags, while the same
     * page carried all three in a script tag beside it.
     *
     * Spread from `articleOpenGraph` rather than written out, so the four
     * values cannot come apart from `articleJsonLd`'s. `article:tag` repeats
     * once per tag, which is why this is a list.
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
     * THE WEBMENTION ENDPOINT, beside the twin because both are discovery.
     *
     * A sender looks in two places and stops at the first: the `Link` header,
     * which the loader above sets, and this element. Both are emitted, because
     * a sender that finds one and not the other has to decide which this site
     * meant, and the protocol's answer to that is that the header wins, which
     * is not a decision worth making it take.
     *
     * `WEBMENTION_URL` is the same constant the header is built from.
     */
    { tagName: "link", rel: "webmention", href: WEBMENTION_URL },
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

/**
 * `srcset` and `sizes` for a cover, or nothing at all.
 *
 * THE SAME TEST AND THE SAME LADDER the markdown pipeline applies to a body
 * image, reached through the same two exports rather than restated: a width the
 * page advertises and the transform route refuses is a broken image in the
 * header. `contentSrcSet` and `CONTENT_SIZES` are the one owner of both.
 *
 * A `/media/` key is an R2 object the transform route will serve at the closed
 * content ladder. Anything else is a static asset under `public/`, served
 * straight from the assets host, and gets a plain `src`: correct rather than
 * degraded, since the file is already the only size it has.
 *
 * Returns a spreadable object so the caller has no branch in its markup, and
 * the empty case spreads to nothing rather than to `undefined` attributes.
 */
function coverResponsive(src: string): { srcSet?: string; sizes?: string } {
  if (!src.startsWith("/media/")) return {};
  return { srcSet: contentSrcSet(src.slice("/media/".length)), sizes: CONTENT_SIZES };
}

/**
 * THE ONE PLACE ON THIS PAGE WHERE THE TEXT IS NOT OURS.
 *
 * The body two hundred lines below is injected with `dangerouslySetInnerHTML`,
 * and the comment there says why: it is rendered at build time from markdown we
 * author, it contains no third-party input, and injecting it is the point of
 * having a pipeline at all.
 *
 * A mention is the exact inverse. Every string in it was read out of a page
 * this site does not control, by a Worker that fetched a URL a stranger chose.
 * So it is RENDERED AS TEXT: React children, escaped by React, with no
 * `dangerouslySetInnerHTML` anywhere in this section, no image, no attribute
 * carrying a source-supplied value except one `href` that `safeHttpHref` has
 * re-parsed at render time.
 *
 * The two sit on one page and the distinction between them is the whole of the
 * rule. First-party markup is injected because we wrote it. Third-party text is
 * escaped because we did not. Neither half is a precaution against the other
 * going wrong; they are two different kinds of thing that happen to render
 * beside each other, and the moment somebody reads this section as "the body is
 * injected, so this could be too" is the moment the rule is gone.
 *
 * @param mention one approved row, as `approvedMentionsFor` selected it
 */
function Mention({
  mention,
}: {
  mention: Route.ComponentProps["loaderData"]["mentions"][number];
}) {
  /*
   * THE AUTHOR'S OWN URL FIRST, THE SOURCE PAGE SECOND, and neither if neither
   * parses. `readAuthor` stores an `author_url` only when the source publishes
   * an h-card carrying one, so most rows fall through to the source, which is
   * the page that did the linking and the more useful destination anyway.
   *
   * A row whose URLs BOTH fail the check still renders: the name becomes plain
   * text with no anchor. Dropping the mention instead would hide something the
   * admin approved from the reader while the moderation queue kept showing it
   * as published, which is a disagreement between two surfaces about what is
   * live.
   */
  const href = safeHttpHref(mention.authorUrl) ?? safeHttpHref(mention.sourceUrl);

  /*
   * THE NAME FALLS BACK TO THE SOURCE URL, not to a word like "Someone".
   *
   * H1's verifier already falls back to the source's hostname, so a row written
   * by the endpoint always carries a name. This covers a row written any other
   * way, and it substitutes a FACT rather than a placeholder: hard rule 13's
   * distinction, in a spot where the invented value would be attributed to a
   * real person on a public page.
   */
  const name = mention.authorName ?? mention.sourceUrl;
  const decided = longDateUTC(mention.decidedAt);

  return (
    <li>
      {href ? (
        /*
         * `nofollow ugc noopener noreferrer`. `ugc` is what this link IS,
         * `nofollow` is what it must not pass on, and the other two are this
         * site's default on every outbound anchor. A validated href in a React
         * element is not injected HTML.
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
   * ONE `postSocial` CALL for the two things this component needs from it: the
   * dek's text and the canonical URL the share links point at. Called here
   * rather than passed down from `meta`, because the two run independently and
   * a value threaded through the loader would be a third place the same rule
   * could be stated. Pure, so calling it twice on one request costs a string
   * concatenation and cannot disagree with itself.
   */
  const { canonical, description: dek } = postSocial(post);

  /*
   * THE NEIGHBOURING PARTS, off the list already on the page.
   *
   * `seriesParts` arrives ordered by part, so the reading path is this post's
   * position in it plus or minus one. Derived rather than queried: a second
   * read would be a second answer to what "the next part" means, and it would
   * have to agree with the list rendered directly beneath it.
   *
   * `findIndex` returns -1 when the post is not in its own series list, which
   * cannot happen for a visible post, and the two lookups below both yield
   * undefined in that case rather than wrapping to the wrong end.
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
      <main className="page" id="main">
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
          THE h-entry, and every microformats2 class on this page is a CLASS on
          markup that was already here. Item I, ruling 50 as amended:
          microformats only, no `rel="me"`, no social links.

          WHY CLASSES AND NOT A SECOND REPRESENTATION. This page already emits
          Article JSON-LD a few lines up, and the two are not redundant with
          each other: JSON-LD is a separate document a crawler reads, and mf2 is
          an annotation of the markup a reader is already being served, which is
          what a webmention sender, a feed reader and an IndieWeb consumer parse.
          Adding a third copy of the same facts would be a third thing to keep
          true; annotating the first copy cannot go out of step with itself.

          `check:microformats` renders this component and parses the result with
          `microformats-parser`, and it compares `dt-published` against the
          FRONTMATTER date rather than against anything this route computed.
        */}
        <article className="post h-entry">
          <header className="post-head">
            <h1 className="p-name">{post.title}</h1>
            {/*
              THE DEK, and it is the SAME STRING the meta tag carries.

              `postSocial(post).description` rather than `post.description`,
              because the two are not the same value: `postSocial` falls back to
              the site description when a post has none, and that fallback is
              the one the `<meta name="description">` above already emits. Using
              the raw column here would put a different sentence on the page
              than in the head for any post that ever hits the fallback, which
              is exactly the drift `postSocial` was extracted to end.
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
                THE UPDATED DATE GAINED AN ELEMENT, and it is the one element
                this arc adds. It was bare text: the label was rendered and the
                machine-readable timestamp behind it was not, so `dt-updated`
                had nothing to take a class from.

                Rendered text is UNCHANGED. `<time>` has no default styling and
                `revisedLabel` is the same string it was, so the only difference
                on the wire is the element and its `datetime`.

                STILL CONDITIONAL, and deliberately: `revisedLabel` is null
                unless the revision is further from publication than
                `REVISED_THRESHOLD_MS`, so most posts carry no `dt-updated` at
                all. That is the correct reading of "when the post has one": a
                post nobody has revised has no updated date, and emitting the
                row's `updatedAt` regardless would publish a sync timestamp as
                if it were an edit.
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
              THE AUTHOR, and it is HIDDEN, which is a real cost and is stated
              rather than glossed.

              This page has never carried a byline. Every post here is Dustin's,
              the footer says so on every page and the Person JSON-LD says so to
              a machine, so a visible byline would be new furniture on a page
              whose design nobody asked to change; the constraint on this arc is
              that nothing visual moves. `p-author` is not optional in an
              h-entry that wants to be consumed, so the h-card goes in `hidden`.

              `hidden` and not `.sr-only`: `.sr-only` is still announced, and a
              screen reader gaining a name and a link on every post IS a change
              to the page, just not one a screenshot catches. `hidden` removes
              it from the render AND from the accessibility tree, and every mf2
              parser reads the markup rather than the computed style, which is
              the same reason the JSON-LD above works.

              WHAT WOULD RETIRE THIS: a visible byline. If one ever lands, move
              these two classes onto it and delete this block, because a hidden
              copy beside a visible one is two owners of the same fact.
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
            THE COVER, drawn at last. It has been stored, read by `postSocial`
            for the card and by `articleJsonLd` for the structured data, and
            never once shown to a reader on the page it belongs to.

            ABSENT, NOT EMPTY, when there is no cover. The whole `<figure>` is
            conditional rather than a figure wrapping a missing image: an empty
            figure is a landmark a screen reader announces and a box the layout
            reserves, for nothing.

            RESPONSIVE ONLY FOR `/media/` KEYS, which is the rule the body
            images already follow and the reason `coverSrcSet` is a helper
            rather than an inline expression. An R2 object can be transformed to
            the closed width ladder; a static asset under `public/` is served
            straight from the assets host and never passes the transform route,
            so advertising widths for one would offer URLs that 404.

            EAGER AND HIGH PRIORITY, deliberately against the usual advice. This
            is the first image on the page and, when present, the LCP element:
            lazy-loading it would defer the very paint the metric measures.
            Every image inside the body keeps the pipeline's own loading rules.

            NO WIDTH OR HEIGHT, and that is a gap rather than a decision. D1
            stores `cover_image` and `cover_alt` and no dimensions, so nothing
            here can state an intrinsic size without a schema change and a
            second read. The CSS gives the figure a stable width so the shift is
            bounded to height alone.
          */}
          {post.coverImage && (
            <figure className="post-cover">
              <img
                src={post.coverImage}
                alt={post.coverAlt ?? ""}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                {...coverResponsive(post.coverImage)}
              />
            </figure>
          )}

          {/*
            THE SERIES BLOCK. The list of parts is not new; what is new is that
            the series NAME is now a link, and that the reading path has its own
            two controls.

            The roadmap's own summary of this gap reads "`series`/`part`:
            in-post navigation, no hub URL". The navigation was here and the
            name was inert text, so a reader could see the set and could not
            reach it. `seriesPath` is the one owner of that address.

            THE LIST AND THE PAIR DO DIFFERENT JOBS, which is why both are here
            rather than one replacing the other. The ordered list is the table
            of contents: every part, with the current one marked. The previous
            and next targets are the page turn, and they carry the LABEL as well
            as the title, so a reader can tell direction without counting. Part
            one shows no previous and the last shows no next, because there is
            nothing to offer rather than something to disable.
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
            SHARING, and every one of these is an ordinary anchor.

            BESIDE the agent row rather than merged into it, because they answer
            different questions: that row is "take this post elsewhere to read
            it", this one is "point somebody else at it". The agent row is
            unchanged.

            THE PERMALINK IS THE COPY-LINK, and it needs no script at all. The
            usual shape is a button that writes to the clipboard, which is a
            control that does nothing for a reader without JavaScript and looks
            identical to one that works. An anchor to the canonical URL is the
            honest version: it is visible, focusable, right-clickable, and on
            touch it is long-pressable, which is how a link gets copied on a
            phone anyway. NO enhancement is registered for it. The bundle is
            near its measured ceiling and this page's whole point is that it
            works without script; adding bytes to reimplement what the browser
            already does would trade both away for nothing.

            The remaining intent is a plain GET link to LinkedIn's own share
            endpoint, with `rel="noopener noreferrer"` and no `target`, so it
            behaves like every other outbound link on the page. It read "the two
            intents" until 2026-09-10, when the Bluesky one left under ruling 50
            and the sentence describing it would have gone on being read as a
            statement about a link that was not there.
          */}
          <nav className="post-actions post-share" aria-label="Share this post">
            {/*
              THE PERMALINK IS ALSO THE h-entry's `u-url`, and that is why the
              class landed here rather than on a new hidden element: this anchor
              already holds the canonical absolute URL, it is visible, and it is
              the one a reader copies. A microformats consumer and a human now
              read the same element.

              SHARE ON BLUESKY LEFT ON 2026-09-10, ruling 50: no Mastodon, no
              Bluesky, ever. It was a share intent rather than a profile link,
              which is why it survived the ruling's first pass, but the ruling's
              subject is the site's relationship with those networks and an
              intent button is this site inviting readers into one.
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
            MENTIONS FROM OTHER SITES, and the grounds are on the `Mention`
            component above: this is the one block on the page whose text is not
            ours, and it is therefore escaped text where the body is injected
            markup. Read that comment beside the body's.

            ABSENT, NOT EMPTY, on the cover figure's grounds a few hundred lines
            up: an empty section is a landmark a screen reader announces and a
            heading a reader scrolls to, for nothing. Most posts have no
            approved mention and should render no trace of the feature.
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
              {/*
                THE DESCRIPTION, so a related list stops being three bare
                titles a reader has to guess at. The ranking above is untouched:
                `withRelated` sorts on shared tags, date and slug, and the field
                added here takes no part in that.

                Rendered only when the row HAS one. Rows written before
                2026-09-03 carry no description in their stored blob, so this
                degrades to the title it always was rather than to an empty
                paragraph, until the next sync rewrites them.
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
          PREV AND NEXT AS TARGETS, not as a line of text.

          They were two inline links reading "Previous: <title>", so the label
          and the title were one run of text and the hit area was whatever the
          words happened to occupy. Each is now a bordered block carrying the
          label above the title, which gives it a real 24px-plus target on
          touch and lets the direction be read before the title rather than
          parsed out of the same sentence.

          NO IMAGE, deliberately. The verified reference carries a label and a
          title and nothing else, and a thumbnail here would be a third image
          on a page that already has a cover and a card.

          `rel="prev"` and `rel="next"` are kept: they are the machine-readable
          half and nothing about the styling replaces them.
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
      <SiteFooter />
      <BlogEnhancements />
    </>
  );
}
