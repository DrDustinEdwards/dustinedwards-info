import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("blog", "routes/blog._index.tsx"),
  // Ordered before the :slug routes so the feed is not read as a post slug.
  route("blog/rss.xml", "routes/blog.rss[.xml].ts"),
  route("blog/feed.json", "routes/blog.feed[.json].ts"),
  route("blog/atom.xml", "routes/blog.atom[.xml].ts"),
  route("blog/tags/:tag/rss.xml", "routes/blog.tags.$tag.rss[.xml].ts"),
  route("blog/tags/:tag/feed.json", "routes/blog.tags.$tag.feed[.json].ts"),
  route("blog/tags/:tag", "routes/blog.tags.$tag.tsx"),
  route("blog/series/:series/rss.xml", "routes/blog.series.$series.rss[.xml].ts"),
  route("blog/series/:series/feed.json", "routes/blog.series.$series.feed[.json].ts"),
  route("blog/series/:series", "routes/blog.series.$series.tsx"),
  route("blog/:slug.md", "routes/blog.$slug[.md].ts"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  // Top level, never under the post route: that route sends public cache headers, Workers Cache
  // does not key on cookies and a preview link is cookieless, so sharing it would cache a draft.
  route("preview/:token", "routes/preview.$token.tsx"),
  // The legacy WordPress URL, which is indexed, so the Worker takes it over rather than redirecting.
  route("phage-discovery", "routes/phage-discovery.tsx"),
  route("publications", "routes/publications.tsx"),
  // The citation exports precede the page routes so a slug ending in `.bib` cannot collide. Paper pages
  // take a trailing slash: page and PDF in one directory is Scholar's condition for citation_pdf_url.
  route("publications.bib", "routes/publications[.bib].ts"),
  route("publications.ris", "routes/publications[.ris].ts"),
  route("publications.json", "routes/publications[.json].ts"),
  route("publications/:slug.bib", "routes/publications.$slug[.bib].ts"),
  route("publications/:slug.ris", "routes/publications.$slug[.ris].ts"),
  route("publications/:slug", "routes/publications.$slug.tsx"),
  route("about", "routes/about.tsx"),
  // `/colophon` is the IndieWeb convention tooling expects; the page title carries the legibility.
  route("colophon", "routes/colophon.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("projects", "routes/projects.tsx"),
  route("playground", "routes/playground.tsx"),
  // A real public route, not a local page, because the browser and contrast gates photograph it.
  route("playground/ui", "routes/playground.ui.tsx"),
  // Before /search, and a resource route so it can stream a raw Response.
  route("search/ask", "routes/search.ask.ts"),
  route("search", "routes/search.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
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
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig;
