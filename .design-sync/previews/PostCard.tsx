/**
 * PostCard previews.
 *
 * The card renders an `<li>`, so every cell puts it inside the `<ul
 * className="post-list">` the three listing routes wrap it in. Rendered bare it
 * is an orphan list item and the spacing is not the spacing the site has.
 *
 * Content is REAL, taken from `content/posts/*.md` frontmatter, because the
 * card's whole layout question is what a two-line title over a four-line
 * description does, and invented short strings answer a different question.
 */

import { PostCard } from "dustinedwards-info";

const listing = { display: "block" } as const;

/** The ordinary case: date, reading time, description, tags. */
export function Default() {
  return (
    <ul className="post-list" style={listing}>
      <PostCard
        post={{
          slug: "agent-write-access-to-a-live-site",
          title: "Giving an AI agent write access to a live site",
          description:
            "How to grant an AI agent real write access to a production site safely: one shared write path, a single human-reserved operation enforced in code, tamper-evident state in version control, and the draft leak that revealed the method's hardest problem.",
          publishAt: "2026-07-30T00:00:00.000Z",
          readingTimeMinutes: 24,
          series: null,
          part: null,
          tags: ["cloudflare", "agents", "mcp", "security", "architecture"],
        }}
      />
    </ul>
  );
}

/** A post that belongs to a series, which adds the part line under the meta row. */
export function InASeries() {
  return (
    <ul className="post-list" style={listing}>
      <PostCard
        post={{
          slug: "ai-answer-mode-on-site-search",
          title: "Adding an AI answer mode to site search with Cloudflare AI Search",
          description:
            "How to add a retrieval-augmented answer mode to a site with Cloudflare AI Search: uploaded storage versus the crawler, save-time index sync, three cost gates in front of a paying endpoint, and the Durable Objects atomicity measurement behind them.",
          publishAt: "2026-07-28T00:00:00.000Z",
          readingTimeMinutes: 31,
          series: "Search on Cloudflare",
          part: 2,
          tags: ["cloudflare", "ai-search", "search"],
        }}
      />
    </ul>
  );
}

/**
 * Every optional field absent. Each of description, series, reading time and
 * tags is conditionally rendered, so this is the card's real floor and the cell
 * that catches a margin which only collapses when something is present.
 */
export function TitleAndDateOnly() {
  return (
    <ul className="post-list" style={listing}>
      <PostCard
        post={{
          slug: "color-palette-the-build-can-check",
          title: "A colour palette the build can check",
          description: null,
          publishAt: "2026-08-14T00:00:00.000Z",
          readingTimeMinutes: null,
          series: null,
          part: null,
          tags: [],
        }}
      />
    </ul>
  );
}

/** Three cards together, which is how the card is actually seen: the rhythm between them is the design. */
export function AListing() {
  const posts = [
    {
      slug: "blog-reading-without-javascript",
      title: "A blog reading experience that works without JavaScript",
      description:
        "How to build a full reading experience, table of contents, progress bar, copy buttons, footnote previews, lightbox, that works with JavaScript disabled and enhances in under 2 kB gzipped.",
      publishAt: "2026-07-28T00:00:00.000Z",
      readingTimeMinutes: 28,
      series: null,
      part: null,
      tags: ["performance", "accessibility", "progressive-enhancement"],
    },
    {
      slug: "mcp-server-on-workers-with-oauth",
      title: "An MCP server on Workers with OAuth",
      description:
        "Standing up a remote Model Context Protocol server on Cloudflare Workers, with the authorization flow, the token store, and the tool surface a publishing client actually needs.",
      publishAt: "2026-08-02T00:00:00.000Z",
      readingTimeMinutes: 19,
      series: null,
      part: null,
      tags: ["cloudflare", "mcp", "oauth"],
    },
    {
      slug: "color-palette-the-build-can-check",
      title: "A colour palette the build can check",
      description:
        "Contrast ratios that a gate computes rather than a human eyeballs, and what changes about a palette when every pair has to survive a build step.",
      publishAt: "2026-08-14T00:00:00.000Z",
      readingTimeMinutes: 12,
      series: null,
      part: null,
      tags: ["design", "accessibility"],
    },
  ];
  return (
    <ul className="post-list" style={listing}>
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </ul>
  );
}

/**
 * The same listing under the dark theme. `[data-theme="dark"]` is an
 * unqualified attribute selector in app.css, so it redefines the tokens for
 * this subtree exactly as it does on `<html>`.
 */
export function DarkTheme() {
  return (
    <div data-theme="dark" style={{ background: "var(--surface)", color: "var(--text)", padding: "1.5rem" }}>
      <ul className="post-list" style={listing}>
        <PostCard
          post={{
            slug: "agent-write-access-to-a-live-site",
            title: "Giving an AI agent write access to a live site",
            description:
              "How to grant an AI agent real write access to a production site safely: one shared write path, a single human-reserved operation enforced in code, and the draft leak that revealed the method's hardest problem.",
            publishAt: "2026-07-30T00:00:00.000Z",
            readingTimeMinutes: 24,
            series: null,
            part: null,
            tags: ["cloudflare", "agents", "security"],
          }}
        />
      </ul>
    </div>
  );
}
