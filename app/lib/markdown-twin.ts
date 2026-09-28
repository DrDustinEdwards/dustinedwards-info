import { prefersType } from "./negotiate.mjs";
import { NO_STORE_CACHE_CONTROL, SITE_ORIGIN } from "./seo";

export function linkToMarkdown(slug: string) {
  return alternateMarkdownLink(`/writing/${slug}.md`);
}

/** `path` includes the `.md`. Absolute, so it matches the blog twin and `canonicalLink`. */
export function alternateMarkdownLink(path: string) {
  return `<${SITE_ORIGIN}${path}>; rel="alternate"; type="text/markdown"`;
}

/**
 * The `Link` header a machine-only document carries to name the HTML page it stands for: a post's
 * twin names the post, llms.txt and llms-full.txt name the home page. Canonical, not alternate, so a
 * crawler that reaches the twin first credits the page instead. The paper twins are assets and set the
 * same header from public/_headers, where code cannot reach.
 */
export function canonicalLink(path: string) {
  return `<${SITE_ORIGIN}${path}>; rel="canonical"`;
}

export function prefersMarkdown(request: Request) {
  return prefersType(request, "text/markdown");
}

/**
 * The negotiated `/writing/:slug` variant must never be stored: under `Vary: Accept, Cookie` a second
 * stored variant lets a cookie-bearing request HIT the cookieless one, skipping the Worker's
 * `private, no-store` downgrade. Do not "optimize" it to `SHARED_CACHE_CONTROL`.
 */
export function markdownResponse(slug: string, body: string, cacheControl: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": cacheControl,
      link: canonicalLink(`/writing/${slug}`),
      // Only the never-stored response is the negotiated one, so only it varies on Accept.
      ...(cacheControl === NO_STORE_CACHE_CONTROL ? { vary: "Accept" } : {}),
    },
  });
}
