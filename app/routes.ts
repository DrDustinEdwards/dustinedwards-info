import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Public
  index("routes/home.tsx"),
  route("blog", "routes/blog._index.tsx"),
  // Ordered before the :slug routes so the feed is not read as a post slug.
  route("blog/rss.xml", "routes/blog.rss[.xml].ts"),
  route("blog/feed.json", "routes/blog.feed[.json].ts"),
  route("blog/:slug.md", "routes/blog.$slug[.md].ts"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
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
    route("sites", "routes/admin.sites.tsx"),
    route("content", "routes/admin.content.tsx"),
    route("tools", "routes/admin.tools.tsx"),
    route("logout", "routes/admin.logout.tsx"),
    route("media", "routes/admin.media.ts"),
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
  // The operator publish path. Bearer token, not the Better Auth session, so it
  // sits outside the /admin subtree the middleware gates.
  route("api/operator", "routes/api.operator.ts"),
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig;
