import { prefersType } from "./negotiate";
import { PUBLIC_CACHE_CONTROL, SITE_ORIGIN } from "./seo";

/**
 * Every post is reachable as HTML and as its markdown source. The two are the
 * same resource, so they advertise each other with a Link header and the HTML
 * route varies on Accept.
 *
 * Shared by `/blog/:slug` (which negotiates) and `/blog/:slug.md` (which does
 * not), so the content type and the Link relation are defined once.
 */

/** `Link` header pointing from the HTML representation at the markdown one. */
export function linkToMarkdown(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}.md>; rel="alternate"; type="text/markdown"`;
}

/** `Link` header pointing from the markdown representation at the HTML one. */
export function linkToHtml(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}>; rel="alternate"; type="text/html"`;
}

/**
 * Whether the client asked for markdown in preference to HTML.
 *
 * The q-value parsing moved to app/lib/negotiate.ts when /search gained a JSON
 * representation and needed the same comparison. One parser, two callers: a
 * second copy would drift, and it would drift silently, because a browser that
 * starts being served the wrong representation still renders something.
 */
export function prefersMarkdown(request: Request) {
  return prefersType(request, "text/markdown");
}

/** The markdown representation of a post, with its headers. */
export function markdownResponse(slug: string, body: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": PUBLIC_CACHE_CONTROL,
      link: linkToHtml(slug),
      vary: "Accept",
    },
  });
}
