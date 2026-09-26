import { Link, data } from "react-router";
import { PostHeadBlocks, type WritingStatus } from "~/components/post-head-blocks";
import { PostBacklinks } from "~/components/post-backlinks";
import { PostHistory } from "~/components/post-history";
import { PostMentions } from "~/components/post-mentions";
import { PostRail, ymd } from "~/components/post-rail";
import { SeriesNav } from "~/components/post-series-nav";
import { EvidenceRow } from "~/components/evidence-row";
import { ENHANCE_GZIP_BYTES } from "virtual:enhance";

import { Enhance } from "~/components/enhance";
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
import { blogPostView } from "~/lib/blog-view";
import { jsonLd } from "~/lib/json-ld.mjs";
import { getEnv } from "~/lib/context";
import { longDateUTC } from "~/lib/long-date.mjs";
import { coverDimensions, coverResponsive } from "~/lib/cover-image.mjs";
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

import "~/styles/post-rail.css";
import "~/styles/evidence-row.css";
import "~/styles/post-shell.css";
import "~/styles/prose.css";
import "~/styles/post-enhancements.css";
import "~/styles/post-head-blocks.css";
import "~/styles/post-disclosures.css";

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

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getBlogPost(getEnv(context), params.slug);
  if (!post) {
    throw data("Not found", { status: 404 });
  }

  const seriesParts = post.series
    ? await listSeriesParts(getEnv(context), post.series)
    : [];

  const view = blogPostView(post, seriesParts);

  /* Re-checked against live rows: a stored list can name a post unpublished since it was written. */
  const stillPublic = await publiclyVisibleSlugs(
    getEnv(context),
    [...view.post.related, ...view.post.backlinks].map((item) => item.slug),
  );

  /* Here, not in `blogPostView`: `/preview/:token` shares that projection, and a draft preview must not grow mentions. */
  const mentions = await approvedMentionsFor(getEnv(context), post.slug);

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
        Link: [linkToMarkdown(post.slug), linkToWebmention()].join(", "),
        /* Set in the loader: `HeadersArgs` carries no `params`, so the slug is not in scope there. */
        "Cache-Tag": cacheTags(post.slug),
      },
    },
  );
}

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
  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { post } = loaderData;
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
    { name: "twitter:image", content: image },
    ...articleOpenGraph(SITE_ORIGIN, toArticleSeo(post)),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${canonical}.md`,
    },
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
    tags: post.tags,
  };
}

/** One day: a post synced the day it was published has been deployed, not revised. */
const REVISED_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, toc, seriesParts, mentions } = loaderData;

  const { canonical, description: dek } = postSocial(post);

  const published = post.publishAt ? new Date(post.publishAt).getTime() : null;
  const revised = post.updatedAt ? new Date(post.updatedAt).getTime() : null;
  const revisedLabel =
    published !== null && revised !== null && revised - published > REVISED_THRESHOLD_MS
      ? longDateUTC(post.updatedAt)
      : null;

  const sections = toc.filter((entry) => entry.depth === 2);

  const gzipBytes = ENHANCE_GZIP_BYTES.blog;
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
      <main className="tracks post-tracks h-entry" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              articleJsonLd(SITE_ORIGIN, toArticleSeo(post)),
              breadcrumbJsonLd(SITE_ORIGIN, [
                ["Home", "/"],
                ["Blog", "/blog"],
                [post.title, `/blog/${post.slug}`],
              ]),
            ]),
          }}
        />

        <header className="post-head">
          <h1 className="p-name">{post.title}</h1>
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

        <article className="post post-body">
          <PostHeadBlocks
            writingStatus={(post.writingStatus as WritingStatus | null) ?? null}
            assumedAudience={post.assumedAudience ?? null}
            keyTakeaways={post.keyTakeaways ?? null}
          />

          {/* Eager and high priority: this is the LCP element when present. */}
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

          {post.series && seriesParts.length > 1 && (
            <SeriesNav post={post} series={post.series} seriesParts={seriesParts} />
          )}

          {/* Build-time HTML from markdown we author; no third-party input, so it can be injected. */}
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
                `Read ${SITE_ORIGIN}/blog/${post.slug}.md and summarize it.`,
              )}`}
              rel="noopener noreferrer"
            >
              Open in Claude
            </a>
            <a
              className="post-action"
              href={`https://chatgpt.com/?q=${encodeURIComponent(
                `Read ${SITE_ORIGIN}/blog/${post.slug}.md and summarize it.`,
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

          {mentions.length > 0 && <PostMentions mentions={mentions} />}

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

          {post.backlinks.length > 0 && <PostBacklinks backlinks={post.backlinks} />}

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
        </article>
      </main>
      <ShellFooter />
      <Enhance module="blog" />
    </>
  );
}
