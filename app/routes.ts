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
    route("posts", "routes/admin.posts._index.tsx"),
    route("posts/new", "routes/admin.posts.new.tsx"),
    route("posts/:slug/edit", "routes/admin.posts.$slug.edit.tsx"),
    route("posts/:slug/history", "routes/admin.posts.$slug.history.tsx"),
  ]),

  // API
  route("api/health", "routes/api.health.ts"),
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig;
