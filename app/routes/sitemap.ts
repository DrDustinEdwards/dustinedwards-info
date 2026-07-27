import { listPublicPosts } from "~/db";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/sitemap";

// Static, always-present URLs. /publications is archived: it still serves at
// its URL but is noindex, so it is deliberately absent here.
const STATIC_PATHS = ["/", "/phage-hunters", "/research"];

export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const posts = await listPublicPosts(getEnv(context));

  const urls = [
    ...STATIC_PATHS.map((path) => ({ loc: origin + path, lastmod: null as Date | null })),
    ...posts.map((p) => ({
      loc: `${origin}/${p.slug}`,
      lastmod: p.updatedAt,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${
        u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""
      }</url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
