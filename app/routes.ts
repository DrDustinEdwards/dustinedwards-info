import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Writing: the posts, at /writing since the 2026-09-27 site structure. The module files keep their
  // blog.* names; only the addresses moved. Every other /blog address 301s in the gateway
  // (app/lib/path-moves.mjs).
  route("writing", "routes/blog._index.tsx"),
  // Ordered before the :slug routes so the feed is not read as a post slug.
  route("writing/rss.xml", "routes/blog.rss[.xml].ts"),
  route("writing/feed.json", "routes/blog.feed[.json].ts"),
  route("writing/atom.xml", "routes/blog.atom[.xml].ts"),
  route("writing/tags/:tag/rss.xml", "routes/blog.tags.$tag.rss[.xml].ts"),
  route("writing/tags/:tag/feed.json", "routes/blog.tags.$tag.feed[.json].ts"),
  route("writing/tags/:tag", "routes/blog.tags.$tag.tsx"),
  route("writing/series/:series/rss.xml", "routes/blog.series.$series.rss[.xml].ts"),
  route("writing/series/:series/feed.json", "routes/blog.series.$series.feed[.json].ts"),
  route("writing/series/:series", "routes/blog.series.$series.tsx"),
  route("writing/:slug.md", "routes/blog.$slug[.md].ts"),
  route("writing/:slug", "routes/blog.$slug.tsx"),
  // The old feed addresses keep answering with the feed itself, not a redirect: a feed reader is
  // told the address once and may never follow a 301. Same modules, their own route ids.
  route("blog/rss.xml", "routes/blog.rss[.xml].ts", { id: "legacy-blog-rss" }),
  route("blog/feed.json", "routes/blog.feed[.json].ts", { id: "legacy-blog-feed" }),
  route("blog/atom.xml", "routes/blog.atom[.xml].ts", { id: "legacy-blog-atom" }),
  route("blog/tags/:tag/rss.xml", "routes/blog.tags.$tag.rss[.xml].ts", { id: "legacy-tag-rss" }),
  route("blog/tags/:tag/feed.json", "routes/blog.tags.$tag.feed[.json].ts", { id: "legacy-tag-feed" }),
  route("blog/series/:series/rss.xml", "routes/blog.series.$series.rss[.xml].ts", { id: "legacy-series-rss" }),
  route("blog/series/:series/feed.json", "routes/blog.series.$series.feed[.json].ts", { id: "legacy-series-feed" }),
  // Top level, never under the post route: that route sends public cache headers, Workers Cache
  // does not key on cookies and a preview link is cookieless, so sharing it would cache a draft.
  route("preview/:token", "routes/preview.$token.tsx"),
  // Under Research since the 2026-09-27 site structure; the old /publications addresses 301.
  route("research/publications", "routes/publications.tsx"),
  // The citation exports precede the page routes so a slug ending in `.bib` cannot collide. Paper pages
  // take a trailing slash: page and PDF in one directory is Scholar's condition for citation_pdf_url.
  route("research/publications.bib", "routes/publications[.bib].ts"),
  route("research/publications.ris", "routes/publications[.ris].ts"),
  route("research/publications.json", "routes/publications[.json].ts"),
  route("research/publications/:slug.bib", "routes/publications.$slug[.bib].ts"),
  route("research/publications/:slug.ris", "routes/publications.$slug[.ris].ts"),
  route("research/publications/:slug", "routes/publications.$slug.tsx"),
  // The Research pages (app/lib/content-pages.mjs), rendered from markdown at build time. A splat, so the
  // more specific research/publications routes above still win; a path with no page answers 404.
  // Their markdown twins are static assets (build:content), not routes, so they stay out of the Worker.
  route("research/*", "routes/content-page.tsx"),
  route("teaching/*", "routes/teaching.tsx"),
  // Same markdown pages as Research and Teaching. The module is its own file so headers() is this
  // route's, which check:headers reads per file. /projects 301s here (app/lib/path-moves.mjs).
  route("software/*", "routes/software.tsx"),
  route("about", "routes/about.tsx"),
  // The CV, one of the markdown pages; the old 2019 CV PDF address 301s here on the apex host.
  route("cv", "routes/cv.tsx"),
  // The CV's charts for a filter state, which app/enhance/cv.ts swaps in so the page ships no renderer.
  route("cv/charts.json", "routes/cv.charts[.json].ts"),
  // `/colophon` is the IndieWeb convention tooling expects; the page title carries the legibility.
  route("colophon", "routes/colophon.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("contact", "routes/contact.tsx"),
  // 410 Gone for removed WordPress addresses; the gateway renders it in their place on the apex host.
  route("gone", "routes/gone.tsx"),
  // Before /search, and a resource route so it can stream a raw Response.
  route("search/ask", "routes/search.ask.ts"),
  route("search", "routes/search.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route(".well-known/security.txt", "routes/security-txt.ts"),
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full[.txt].ts"),
  route("media/*", "routes/media.$.ts"),
  route("theme", "routes/theme.ts"),
  // Unauthenticated because senders have no credential to offer; bounded in the route file. At the
  // root, not under `/api`, because it is advertised in a `<link>` and is published surface.
  route("webmention", "routes/webmention.ts"),

  route("login", "routes/login.tsx"),

  // Private: the admin layout gates every child via middleware.
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    // Not "traffic": these are origin requests, not reads, and the URL must not claim otherwise.
    route("origin-requests", "routes/admin.origin-requests.tsx"),
    route("mentions", "routes/admin.mentions.tsx"),
    route("tools", "routes/admin.tools.tsx"),
    route("logout", "routes/admin.logout.tsx"),
    route("media", "routes/admin.media._index.tsx"),
    route("media/upload", "routes/admin.media.upload.ts"),
    // Read-only. POST because a whole post body does not belong in a query string, not because it writes.
    route("preview", "routes/admin.preview.ts"),
    route("posts", "routes/admin.posts._index.tsx"),
    route("posts/new", "routes/admin.posts.new.tsx"),
    route("posts/:slug/edit", "routes/admin.posts.$slug.edit.tsx"),
    route("posts/:slug/history", "routes/admin.posts.$slug.history.tsx"),
    // Loader only, no action, so restoring a revision cannot write.
    route("posts/:slug/revisions", "routes/admin.posts.$slug.revisions.tsx"),
  ]),

  route("api/health", "routes/api.health.ts"),
  // Unauthenticated because browsers send reports without credentials; capped and rate limited there.
  route("api/csp-report", "routes/api.csp-report.ts"),
  // Bearer token, not the session, so it sits outside the /admin subtree the middleware gates.
  route("api/operator", "routes/api.operator.ts"),
  // Carrel's key, not the session, and only this prefix: the site-api package guards it.
  route("api/carrel/v1/*", "routes/api.carrel.v1.$.ts"),
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig;
