import { prefersType } from "./negotiate.mjs";
import { NO_STORE_CACHE_CONTROL, SITE_ORIGIN } from "./seo";

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
function linkToHtml(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}>; rel="alternate"; type="text/html"`;
}

/**
 * Whether the client asked for markdown in preference to HTML.
 *
 * The q-value parsing moved to app/lib/negotiate.mjs when /search gained a JSON
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
 * **NEVER STORED UNDER `/blog/:slug`, and this is not a performance oversight.** That route sets
 * `Vary: Accept, Cookie`, and the `Cookie` dimension collapses once a second variant exists under
 * the key: a cookie-bearing request then HITs the stored cookieless variant, the Worker never runs,
 * and the `private, no-store` downgrade in `workers/app.ts` never fires. A response that is never
 * stored cannot become that second variant. Do not "optimize" this back to `SHARED_CACHE_CONTROL`.
 *
 * **THE POLICY IS THE CALLER'S**, because the two face different situations. `/blog/:slug`
 * negotiating on Accept is never stored, for the whole reason above. `/blog/:slug.md` at its own URL
 * is publicly cached: one representation under that key, so there is no second variant for a Cookie
 * dimension to collapse against.
 *
 * **`Vary: Accept` GOES ON THE NEGOTIATED RESPONSE ONLY.** Under `/blog/:slug.md` the body does not
 * depend on Accept at all, and advertising a dimension the Workers Cache key cannot honor is worse
 * than advertising none. `media.$.ts` records that mistake in full.
 */
export function markdownResponse(slug: string, body: string, cacheControl: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": cacheControl,
      link: linkToHtml(slug),
      /*
       * ONLY WHEN THE BODY REALLY DOES VARY, which is only on the negotiated
       * URL. Keyed off the policy rather than off a second parameter: a
       * response that is never stored is the negotiated one by construction,
       * and two flags that must agree are one flag too many.
       */
      ...(cacheControl === NO_STORE_CACHE_CONTROL ? { vary: "Accept" } : {}),
    },
  });
}
