import { prefersType } from "./negotiate";
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
 * `NO_STORE_CACHE_CONTROL` is `private, no-store`, and it is here to stop a SECOND
 * CACHE VARIANT from existing under `/blog/:slug`. Do not "optimise" this back
 * to `SHARED_CACHE_CONTROL`.
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
 * ## THE SPLIT THIS PARAGRAPH REFUSED IS NOW MADE, 2026-08-26
 *
 * What stood here: "this function also serves `/blog/:slug.md`, a distinct URL
 * that never had the variant problem, so that path loses edge caching too. It
 * is one D1 read, and one rule is worth more than a split that invites the next
 * person to re-enable half of it."
 *
 * The reasoning about the RISK is exactly right and is unchanged below. What
 * changed is the measured cost. `llms.txt` advertises the twin as the path for
 * agents and `linkToMarkdown` puts it in a `Link` header on every post, so this
 * is the machine-readable surface of the whole site, and every fetch of it was
 * a `BYPASS` and an origin render. Measured on the wire: `Cache-Control:
 * private, no-store`, `CF-Cache-Status: BYPASS`, on a document that depends on
 * nothing but its own URL.
 *
 * **The policy is now the CALLER'S**, because the two callers face genuinely
 * different situations and always did:
 *
 *   `/blog/:slug` negotiating on Accept   NEVER STORED. Unchanged, and the
 *                                         whole argument above applies to it.
 *   `/blog/:slug.md` at its own URL       PUBLICLY CACHED. One representation
 *                                         under that key, so there is no second
 *                                         variant for a Cookie dimension to
 *                                         collapse against.
 *
 * That is not "re-enabling half of it". The rule the paragraph above was
 * protecting is "the markdown representation under `/blog/:slug` is never
 * stored", and that rule is intact. The twin's own URL was collateral.
 *
 * **`Vary: Accept` GOES on the twin, and that is the other half.** The old
 * comment called it "still true and still correct to advertise". It is neither,
 * once the response is stored: under `/blog/:slug.md` the body does not depend
 * on Accept at all, because markdown is the only representation that URL has.
 * Advertising a dimension the Workers Cache key cannot honour is the mistake
 * `media.$.ts` records in full, and it is worse than advertising none. It stays
 * on the negotiated response, where it is true.
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
