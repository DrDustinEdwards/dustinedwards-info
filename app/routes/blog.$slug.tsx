import { Link, data } from "react-router";

import { BlogEnhancements } from "~/components/blog-enhancements";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import {
  getBlogPost,
  getBlogPostMarkdown,
  listSeriesParts,
  publiclyVisibleSlugs,
} from "~/db";
import { blogPostView } from "~/lib/blog-view";
import { jsonLd } from "~/lib/json-ld.mjs";
import { getEnv } from "~/lib/context";
import { longDateUTC } from "~/lib/long-date.mjs";
import { CONTENT_SIZES, contentSrcSet } from "~/lib/media/widths.mjs";
import { linkToMarkdown, markdownResponse, prefersMarkdown } from "~/lib/markdown-twin";
import {
  HTML_VARY_ACCEPT,
  NO_STORE_CACHE_CONTROL,
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

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, toc, seriesParts } = loaderData;

  /*
   * ONE `postSocial` CALL for the two things this component needs from it: the
   * dek's text and the canonical URL the share links point at. Called here
   * rather than passed down from `meta`, because the two run independently and
   * a value threaded through the loader would be a third place the same rule
   * could be stated. Pure, so calling it twice on one request costs a string
   * concatenation and cannot disagree with itself.
   */
  const { canonical, description: dek } = postSocial(post);

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

        <article className="post">
          <header className="post-head">
            <h1>{post.title}</h1>
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

            The two intents are plain GET links to the services' own share
            endpoints. `rel="noopener noreferrer"` on both, and no `target`, so
            they behave like every other outbound link on the page.
          */}
          <nav className="post-actions post-share" aria-label="Share this post">
            <a className="post-action" href={canonical}>
              Permalink
            </a>
            <a
              className="post-action"
              href={`https://bsky.app/intent/compose?text=${encodeURIComponent(
                `${post.title} ${canonical}`,
              )}`}
              rel="noopener noreferrer"
            >
              Share on Bluesky
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
