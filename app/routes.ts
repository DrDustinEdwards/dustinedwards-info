import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Public
  index("routes/home.tsx"),
  route("blog", "routes/blog._index.tsx"),
  // Ordered before the :slug routes so the feed is not read as a post slug.
  route("blog/rss.xml", "routes/blog.rss[.xml].ts"),
  route("blog/:slug.md", "routes/blog.$slug[.md].ts"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("llms.txt", "routes/llms.ts"),

  // Auth
  route("login", "routes/login.tsx"),

  // Private: the admin layout gates every child via middleware.
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    route("sites", "routes/admin.sites.tsx"),
    route("content", "routes/admin.content.tsx"),
    route("tools", "routes/admin.tools.tsx"),
    route("logout", "routes/admin.logout.tsx"),
  ]),

  // API
  route("api/health", "routes/api.health.ts"),
  route("api/auth/*", "routes/api.auth.$.ts"),
] satisfies RouteConfig;
