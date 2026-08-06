import { prefersType } from "./negotiate";
import { HTML_CACHE_CONTROL, SITE_ORIGIN } from "./seo";

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

/**
 * The markdown representation of a post, with its headers.
 *
 * ## NEVER STORED, and this is not a performance oversight
 *
 * `HTML_CACHE_CONTROL` is `private, no-store`, and it is here to stop a SECOND
 * CACHE VARIANT from existing under `/blog/:slug`. Do not "optimise" this back
 * to `PUBLIC_CACHE_CONTROL`.
 *
 * **The defect it repairs, measured 2026-08-05 with a paired control on fresh
 * URLs.** `/blog/:slug` sets `Vary: Accept, Cookie`. With only the HTML
 * representation in play, a cookie-bearing request correctly BYPASSes and gets
 * `private, no-store` from the downgrade in `workers/app.ts`. But after ONE
 * request for this markdown representation, the same cookie-bearing request
 * gets a `HIT` and `public`: the edge answers from the stored cookieless
 * variant, the Worker never runs, the downgrade never fires, and a reader with
 * `theme=dark` is served the light document. `Accept` separates storage
 * correctly; it is the `Cookie` dimension that collapses once a second variant
 * exists under the key.
 *
 * A response that is never stored cannot become that second variant. That is
 * the whole mechanism, and it is why the fix is here rather than on the HTML
 * side, which is measured correct in the single-variant case.
 *
 * **The trigger is an advertised path**, not a hypothetical: `llms.txt`
 * documents the `Accept: text/markdown` form, and `linkToMarkdown` puts it in a
 * `Link` header on every post.
 *
 * COST, stated rather than hidden: this function also serves `/blog/:slug.md`,
 * a distinct URL that never had the variant problem, so that path loses edge
 * caching too. It is one D1 read, and one rule ("the markdown representation is
 * never stored") is worth more than a split that invites the next person to
 * re-enable half of it.
 *
 * The documented repair is a Cache Rule with `bypass` on `Cookie`, which needs
 * a proxied zone and is therefore a DNS-cutover item. See `media.$.ts` for the
 * doc citations.
 */
export function markdownResponse(slug: string, body: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": HTML_CACHE_CONTROL,
      link: linkToHtml(slug),
      // Still true and still correct to advertise: the body genuinely depends
      // on Accept. It is inert on a response that is never stored, and removing
      // it would misdescribe the resource to any cache that is not Cloudflare's.
      vary: "Accept",
    },
  });
}
