import { prefersType } from "./negotiate.mjs";
import { NO_STORE_CACHE_CONTROL, SITE_ORIGIN } from "./seo";

export function linkToMarkdown(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}.md>; rel="alternate"; type="text/markdown"`;
}

function linkToHtml(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}>; rel="alternate"; type="text/html"`;
}

export function prefersMarkdown(request: Request) {
  return prefersType(request, "text/markdown");
}

/**
 * The negotiated `/blog/:slug` variant must never be stored: under `Vary: Accept, Cookie` a second
 * stored variant lets a cookie-bearing request HIT the cookieless one, skipping the Worker's
 * `private, no-store` downgrade. Do not "optimize" it to `SHARED_CACHE_CONTROL`.
 */
export function markdownResponse(slug: string, body: string, cacheControl: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": cacheControl,
      link: linkToHtml(slug),
      // Only the never-stored response is the negotiated one, so only it varies on Accept.
      ...(cacheControl === NO_STORE_CACHE_CONTROL ? { vary: "Accept" } : {}),
    },
  });
}
