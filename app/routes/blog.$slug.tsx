import { JsonLd } from "capsomer/react/json-ld";
import { Link, data } from "react-router";
import { PostHeadBlocks, type WritingStatus } from "~/components/post-head-blocks";
import { Breadcrumb } from "~/components/breadcrumb";
import { PostHistory } from "~/components/post-history";
import { PostRail, ymd } from "~/components/post-rail";
import { Signs } from "capsomer/react/manual";
import { RelatedLinks } from "capsomer/react/related-links";
import { SeriesNav } from "capsomer/react/series-nav";
import { httpHref } from "capsomer/behavior/related-links";
import { seriesPath } from "~/lib/series-path.mjs";
import { EvidenceRow } from "~/components/evidence-row";
import { ISLAND_GZIP_BYTES } from "virtual:islands";

import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import {
  approvedMentionsFor,
  getBlogPost,
  getBlogPostMarkdown,
  listSeriesParts,
  nextScheduledPublishAt,
  publiclyVisibleSlugs,
} from "~/db";
import { WEBMENTION_URL, linkToWebmention } from "~/lib/webmention/advertise";
import { blogPostView } from "~/lib/blog-view";
import { renameRedirect } from "@dustinedwards/site-runtime/url";
import { redirectFor } from "~/lib/carrel/post-state.server";
import { getEnv, postPreviewContext } from "~/lib/context";
import { formatDate } from "capsomer/behavior/time";
import { Picture } from "capsomer/react/picture";
import { articleCrops, contentPicture } from "~/lib/media/images.mjs";
import { linkToMarkdown, markdownResponse, prefersMarkdown } from "~/lib/markdown-twin";
import {
  HTML_VARY_ACCEPT,
  NO_STORE_CACHE_CONTROL,
  cacheTags,
  EDGE_CACHE_HEADER,
  scheduledEdgeCacheControl,
  SHARED_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  articleJsonLd,
  articleFacts,
  postSocial,
  siteHead,
  type Trail,
} from "~/lib/seo";
import { PROSE_PRELOADS } from "~/lib/preloads";
import type { Route } from "./+types/blog.$slug";

import "~/styles/post-rail.css";
import "~/styles/evidence-row.css";
import "capsomer/tokens.css";
import "capsomer/enarratio.css";
import "capsomer/chart-frame.css";
import "capsomer/series-nav.css";
import "capsomer/related-links.css";
import "~/styles/post-shell.css";
import "~/styles/prose.css";
import "~/styles/post-enhancements.css";
import "capsomer/dialog.css";
import "capsomer/button.css";
import "capsomer/lightbox.css";
import "capsomer/reading-progress.css";
import "~/styles/post-head-blocks.css";
import { RENDERED } from "~/lib/content/render-version";
import { PROSE } from "~/lib/prose-context";
import { markup } from "capsomer/behavior/trusted-html";

/** Middleware, not the loader: a document route's loader cannot return a raw Response. */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, params, context }, next) => {
    if (!prefersMarkdown(request)) return next();

    const post = await getBlogPostMarkdown(getEnv(context), params.slug);
    if (!post) return next();
    /* Never stored: this shares a cache key with the HTML document, so a stored copy collapses the Cookie dimension for both. */
    return markdownResponse(params.slug, post.body, NO_STORE_CACHE_CONTROL);
  },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  // A Carrel preview renders its own row through this same loader, so it matches the published page.
  const preview = context.get(postPreviewContext);
  const post =
    preview?.slug === params.slug ? preview : await getBlogPost(getEnv(context), params.slug);
  if (!post) {
    // A post Carrel renamed keeps its old address, permanently moved (drizzle/0038_carrel_posts.sql); site-runtime's
    // renameRedirect keeps the query and answers a method other than GET with a 308.
    const moved = await renameRedirect(request, {
      prefix: "/writing/",
      renames: (slug) => redirectFor(getEnv(context), slug),
    });
    if (moved) throw moved;
    throw data("Not found", { status: 404 });
  }

  const seriesParts = post.series ? await listSeriesParts(getEnv(context), post.series) : [];

  const view = blogPostView(post, seriesParts);

  /* Re-checked against live rows: a stored list can name a post unpublished since it was written. */
  const stillPublic = await publiclyVisibleSlugs(
    getEnv(context),
    [...view.post.related, ...view.post.backlinks].map((item) => item.slug),
  );

  const [mentions, nextPublishAt] = await Promise.all([
    approvedMentionsFor(getEnv(context), post.slug),
    /* The previous and next links, the series parts and the related list can each name it once live. */
    nextScheduledPublishAt(getEnv(context)),
  ]);

  return data(
    {
      ...view,
      mentions,
      post: {
        ...view.post,
        related: view.post.related.filter((item) => stillPublic.has(item.slug)),
        backlinks: view.post.backlinks.filter((item) => stillPublic.has(item.slug)),
      },
    },
    {
      /* Comma-joined: RFC 8288's spelling for more than one relation in one `Link`. */
      headers: {
        Link: [linkToMarkdown(post.slug), linkToWebmention(), PROSE_PRELOADS.header].join(", "),
        /* Set in the loader: `HeadersArgs` carries no `params`, so the slug is not in scope there. */
        "Cache-Tag": cacheTags(post.slug),
        [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt),
      },
    },
  );
}

export const links: Route.LinksFunction = () => PROSE_PRELOADS.links;

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers({
    // The theme is a cache-key dimension, not a `Vary`. `Accept` stays: this URL also serves markdown.
    "Cache-Control": SHARED_CACHE_CONTROL,
    Vary: HTML_VARY_ACCEPT,
  });
  // `headers` does not inherit loader headers, so one not forwarded here never reaches the client.
  const link = loaderHeaders.get("Link");
  if (link) headers.set("Link", link);
  const tag = loaderHeaders.get("Cache-Tag");
  if (tag) headers.set("Cache-Tag", tag);
  const edge = loaderHeaders.get(EDGE_CACHE_HEADER);
  if (edge) headers.set(EDGE_CACHE_HEADER, edge);
  return headers;
}

/** One trail for the visible breadcrumb and the head's BreadcrumbList, so the two cannot disagree. */
function postTrail(post: { title: string; slug: string }): Trail {
  return [
    ["Writing", "/writing"],
    [post.title, `/writing/${post.slug}`],
  ];
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { post } = loaderData;
  const {
    canonical,
    canonicalHref,
    noindex,
    title,
    description,
    socialTitle,
    socialDescription,
    image,
  } = postSocial(post);

  return [
    ...siteHead({
      path: `/writing/${post.slug}`,
      title,
      description,
      socialTitle,
      socialDescription,
      image,
      canonical: canonicalHref,
      noindex,
      type: "article",
      article: articleFacts(toArticleSeo(post)),
      markdown: `${canonical}.md`,
      trail: postTrail(post),
    }),
    /* A sender looks in two places and stops at the first, so both are emitted. */
    { tagName: "link", rel: "webmention", href: WEBMENTION_URL },
  ];
}

type LoadedPost = Route.ComponentProps["loaderData"]["post"];

/** The post as the Open Graph and JSON-LD builders read it, so the head and the body describe one article. */
function toArticleSeo(post: LoadedPost): Parameters<typeof articleJsonLd>[1] {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    publishAt: post.publishAt ? new Date(post.publishAt) : null,
    updatedAt: post.updatedAt ? new Date(post.updatedAt) : null,
    coverImage: post.coverImage,
    ogImage: post.ogImage,
    images: articleCrops(post.coverImage, SITE_ORIGIN),
    tags: post.tags,
  };
}

/** One day: a post synced the day it was published has been deployed, not revised. */
// Two screens of text, the length below which a reading bar fills in one flick.
const READING_BAR_MIN_WORDS = 500;
const REVISED_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, toc, seriesParts, mentions } = loaderData;

  const { canonical, description: dek } = postSocial(post);

  const published = post.publishAt ? new Date(post.publishAt).getTime() : null;
  const revised = post.updatedAt ? new Date(post.updatedAt).getTime() : null;
  const revisedLabel =
    published !== null && revised !== null && revised - published > REVISED_THRESHOLD_MS
      ? formatDate(post.updatedAt)
      : null;

  const sections = toc.filter((entry) => entry.depth === 2);

  const gzipBytes = ISLAND_GZIP_BYTES.blog;
  const evidence = [
    post.wordCount > 0 ? `${post.wordCount.toLocaleString("en-US")} words` : null,
    gzipBytes ? `${(gzipBytes / 1000).toFixed(2)} kB gzipped` : null,
    post.sourceBlobSha ? `source hash ${post.sourceBlobSha.slice(0, 7)}` : null,
  ];

  return (
    <>
      <SiteHeader />
      {/*
       * The h-entry is on `main`: the title and the article are siblings in the track grid, so an
       * article-scoped h-entry would have no p-name and no dt-published.
       */}
      <main className="cap-page tracks post-tracks h-entry" id="main" tabIndex={-1}>
        <JsonLd data={articleJsonLd(SITE_ORIGIN, toArticleSeo(post))} />

        <header className="post-head">
          <Breadcrumb trail={postTrail(post)} />
          <h1 className="p-name cap-layout-grid">{post.title}</h1>
          {/* The meta tag's string: `postSocial` falls back to the site description, so the raw column would differ from the head. */}
          <p className="post-dek">{dek}</p>
          <EvidenceRow facts={evidence} />
          {/* `hidden`, not `.sr-only`, which is still announced. mf2 parsers read markup, not computed style. */}
          <p className="p-author h-card" hidden>
            <a className="p-name u-url" href="/">
              {SITE.name}
            </a>
          </p>
        </header>

        <PostRail post={post} revisedLabel={revisedLabel} sections={sections} />

        {/* Capsomer's reading bar, CSS only, filling through the post body below. Only on a post of two screens or more
            (about 500 words), as Prelum's script bar did: on a shorter one it would fill in one flick. */}
        {post.wordCount >= READING_BAR_MIN_WORDS && (
          <div className="cap-reading-progress" aria-hidden="true" />
        )}

        <article className="post post-body">
          <PostHeadBlocks
            writingStatus={(post.writingStatus as WritingStatus | null) ?? null}
            assumedAudience={post.assumedAudience ?? null}
            keyTakeaways={post.keyTakeaways ?? null}
          />

          {/* Eager and high priority: this is the LCP element when present, and the body's first image gives way. */}
          {post.coverImage && (
            <figure className="post-cover">
              <Picture
                picture={contentPicture(post.coverImage, {
                  alt: post.coverAlt ?? "",
                  priority: true,
                })}
              />
            </figure>
          )}

          {post.series && seriesParts.length > 1 && (
            <SeriesNav
              name={post.series}
              href={seriesPath(post.series)}
              parts={seriesParts.map((entry) => ({
                href: `/writing/${entry.slug}`,
                title: entry.title,
              }))}
              current={`/writing/${post.slug}`}
            />
          )}

          {/* Build-time HTML from markdown we author; no third-party input, so it can be injected. */}
          <div
            className="prose e-content"
            {...PROSE}
            data-cap="lightbox"
            data-cap-reading
            {...RENDERED}
            dangerouslySetInnerHTML={markup(post.html)}
          />

          <RelatedLinks
            kind="external"
            title="Further reading"
            items={post.furtherReading.map((item) => ({ href: item.url, title: item.title }))}
          />

          {/* The runway holding position marking (capsomer/manual.css .cap-hold): the post ends here; what follows is
              about it. Drawn, with no words (Dustin, 2026-11-04). */}
          <hr className="cap-hold" />

          <nav className="post-actions" aria-label="Use this post elsewhere">
            <a
              className="post-action"
              href={`/writing/${post.slug}.md`}
              data-copy-markdown={`${SITE_ORIGIN}/writing/${post.slug}.md`}
            >
              Copy as Markdown
            </a>
            <a
              className="post-action"
              href={`https://claude.ai/new?q=${encodeURIComponent(
                `Read ${SITE_ORIGIN}/writing/${post.slug}.md and summarize it.`,
              )}`}
              rel="noopener noreferrer"
            >
              Open in Claude
            </a>
            <a
              className="post-action"
              href={`https://chatgpt.com/?q=${encodeURIComponent(
                `Read ${SITE_ORIGIN}/writing/${post.slug}.md and summarize it.`,
              )}`}
              rel="noopener noreferrer"
            >
              Open in ChatGPT
            </a>
          </nav>

          {/* `.post-share .u-url` is the enhancement's hook for copy-link-to-selection; keep the class if the row moves. */}
          <nav className="post-actions post-share" aria-label="This post's address">
            <a className="post-action u-url" href={canonical}>
              Permalink
            </a>
          </nav>

          {/* A mention is a stranger's: its author's address if that passes, else its source; its name falls back to
              the source address, a fact, never an invented name attributed to a real person. */}
          <RelatedLinks
            kind="mentions"
            title="Mentions"
            items={mentions.map((mention) => ({
              href: httpHref(mention.authorUrl) ?? mention.sourceUrl,
              title: mention.authorName ?? mention.sourceUrl,
              excerpt: mention.excerpt,
              date: mention.decidedAt,
            }))}
          />

          <p className="post-colophon-note">
            Built on the stack described at <Link to="/colophon">/colophon</Link>.
          </p>

          {revisedLabel && post.changelog && (
            <PostHistory
              entries={post.changelog}
              publishedAt={post.publishAt ? ymd(post.publishAt) : null}
              sourceHash={post.sourceBlobSha}
            />
          )}

          <RelatedLinks
            kind="internal"
            title="Linked from"
            items={post.backlinks.map((item) => ({
              href: `/writing/${item.slug}`,
              title: item.title,
            }))}
          />

          <div className="post-nav">
            <Signs
              label="More posts"
              prev={
                post.previous
                  ? {
                      href: `/writing/${post.previous.slug}`,
                      title: post.previous.title,
                      label: "Previous post",
                    }
                  : null
              }
              next={
                post.next
                  ? {
                      href: `/writing/${post.next.slug}`,
                      title: post.next.title,
                      label: "Next post",
                    }
                  : null
              }
            />
          </div>
        </article>
      </main>
      <ShellFooter />
      <template data-island="blog" />
      {post.html.includes("data-enarratio-redraw") ? <template data-island="charts" /> : null}
    </>
  );
}
