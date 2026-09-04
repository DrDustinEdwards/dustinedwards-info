import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Public
  index("routes/home.tsx"),
  route("blog", "routes/blog._index.tsx"),
  // Ordered before the :slug routes so the feed is not read as a post slug.
  route("blog/rss.xml", "routes/blog.rss[.xml].ts"),
  route("blog/feed.json", "routes/blog.feed[.json].ts"),
  /*
   * Atom, alongside RSS and from the same rows. RSS stays the advertised feed;
   * this is the dialect most validators and some readers prefer. It sits with
   * the other feeds and, like them, MUST precede `blog/:slug` or "atom.xml"
   * would be read as a post slug and answer 404.
   */
  route("blog/atom.xml", "routes/blog.atom[.xml].ts"),
  /*
   * The tag archive and its two feeds.
   *
   * `blog/tags/:tag` is two segments where `blog/:slug` is one, so they cannot
   * collide, but these are grouped with the feeds above rather than after the
   * post routes so that everything under `/blog/` that is NOT a post reads as
   * one block. The two feed children are declared before the page for the same
   * reason the site's other feeds are: it keeps the "more specific first" order
   * true by eye as well as by the matcher.
   */
  route("blog/tags/:tag/rss.xml", "routes/blog.tags.$tag.rss[.xml].ts"),
  route("blog/tags/:tag/feed.json", "routes/blog.tags.$tag.feed[.json].ts"),
  route("blog/tags/:tag", "routes/blog.tags.$tag.tsx"),
  /*
   * The series archive and its two feeds, on the tag archive's shape and in the
   * same block for the same reason: everything under `/blog/` that is not a
   * post reads together, and the feed children precede the page so "more
   * specific first" is true by eye as well as by the matcher.
   */
  route("blog/series/:series/rss.xml", "routes/blog.series.$series.rss[.xml].ts"),
  route("blog/series/:series/feed.json", "routes/blog.series.$series.feed[.json].ts"),
  route("blog/series/:series", "routes/blog.series.$series.tsx"),
  route("blog/:slug.md", "routes/blog.$slug[.md].ts"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  /*
   * Draft previews, TOP LEVEL and never a branch of the post route.
   *
   * The placement is the security design, not a filing preference. The post
   * route exports public cache headers, Workers Cache does not key on cookies,
   * and a reviewer holding a preview link is cookieless, so the downgrade in
   * workers/app.ts never fires for them. Sharing a route would put an
   * unpublished post into a shared cache entry. Full grounds in the route file.
   */
  route("preview/:token", "routes/preview.$token.tsx"),
  // Roster, at the LEGACY URL. /phage-discovery is the address the old
  // WordPress page holds and the one that is indexed, so the Worker takes it
  // over at cutover rather than redirecting it. The nine photo assets stay at
  // /phage-hunters/*, which is a static prefix and not a route; the page prefix
  // and the asset prefix differ on purpose. See the route file.
  route("phage-discovery", "routes/phage-discovery.tsx"),
  // The colophon. `/colophon` is the IndieWeb convention and is what tooling
  // expects; the page TITLE carries the legibility ("How this site is built")
  // because the word is not universally known. Ruled, do not swap them.
  route("colophon", "routes/colophon.tsx"),
  // What the site records, in plain English, with every sentence derivable from
  // the code. Linked from the footer on every page, which is 3.2.6.
  route("privacy", "routes/privacy.tsx"),
  // The portfolio index. `/projects` rather than `/portfolio`: the audience is
  // technical and "projects" is what they call the thing, while "portfolio" is
  // what this workspace calls the repo fleet, a different object.
  route("projects", "routes/projects.tsx"),
  // The interactive index of the site's own machinery. Every demo is a GET form
  // rendered server-side, so the page has no client state and every result is a
  // shareable URL.
  route("playground", "routes/playground.tsx"),
  // Ordered before /search so the Ask endpoint is not read as a search param
  // variant, and kept a resource route so it can stream a raw Response.
  route("search/ask", "routes/search.ask.ts"),
  route("search", "routes/search.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full[.txt].ts"),
  route("media/*", "routes/media.$.ts"),
  // The zero-JS half of the theme toggle. Posts the choice, sets the cookie,
  // sends the reader back to the page they were on.
  route("theme", "routes/theme.ts"),

  // Auth
  route("login", "routes/login.tsx"),

  // Private: the admin layout gates every child via middleware.
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    // Per-path origin requests, read from Analytics Engine. The PATH says
    // origin-requests rather than traffic because a URL is something a reader
    // sees, and the panel spends a caption explaining that these are not reads.
    // A URL making the looser claim would undo that in the address bar.
    route("origin-requests", "routes/admin.origin-requests.tsx"),
    route("tools", "routes/admin.tools.tsx"),
    route("logout", "routes/admin.logout.tsx"),
    // The media library page. Its loader is also the picker's listing, which is
    // what keeps one media surface rather than two.
    route("media", "routes/admin.media._index.tsx"),
    // Upload only. It used to be at /admin/media and carried the listing loader
    // too; the listing moved to the page above.
    route("media/upload", "routes/admin.media.upload.ts"),
    // Read-only render of a draft body through the one pipeline. POST because a
    // whole post body does not belong in a query string, not because it writes.
    route("preview", "routes/admin.preview.ts"),
    route("posts", "routes/admin.posts._index.tsx"),
    route("posts/new", "routes/admin.posts.new.tsx"),
    route("posts/:slug/edit", "routes/admin.posts.$slug.edit.tsx"),
    route("posts/:slug/history", "routes/admin.posts.$slug.history.tsx"),
    // Reading git for the editor's revision drawer. Loader only, no action, so
    // ruling 1's "restore loads, it does not write" is enforced by the route's
    // shape rather than by discipline.
    route("posts/:slug/revisions", "routes/admin.posts.$slug.revisions.tsx"),
  ]),

  // API
  route("api/health", "routes/api.health.ts"),
  // The CSP violation sink. Public and unauthenticated because browsers send
  // reports without credentials; capped and rate limited in the route file.
  route("api/csp-report", "routes/api.csp-report.ts"),
  // The operator publish path. Bearer token, not the Better Auth session, so it
  // sits outside the /admin subtree the middleware gates.
  route("api/operator", "routes/api.operator.ts"),
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig;
