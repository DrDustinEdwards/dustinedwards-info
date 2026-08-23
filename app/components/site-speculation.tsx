import { useRouteLoaderData } from "react-router";

import { HEADER_PATHS } from "~/lib/nav";

import type { loader as rootLoader } from "~/root";

/**
 * Speculation Rules for the HEADER, on every public page.
 *
 * `BlogSpeculation` prerenders `/blog/*` and renders on the two blog routes
 * ALONE, so hovering the menu, which is the most-used navigation on the site,
 * speculated nothing anywhere. This covers the header's own destinations and
 * rides in `SiteHeader`, so its scope is exactly "wherever the header is": the
 * seven public routes plus the root error boundary, and never the admin plane,
 * which has its own shell and does not render `SiteHeader`.
 *
 * `moderate` eagerness is hover, matching the blog rules. It is NOT `eager`:
 * eager would prerender four pages on every page load, which is a crawler
 * wearing an optimisation's clothes. Chrome caps moderate-eagerness prerenders
 * at two concurrently and evicts the oldest, so a reader sweeping across the
 * nav costs at most two speculations, not five.
 *
 * `urls` rather than `href_matches`, because these are five exact paths that
 * already exist as a list. A pattern would re-describe them in a second
 * language and could match a path the header does not link to.
 *
 * ## WHAT THIS COSTS A COOKIE-CARRYING READER, stated rather than assumed
 *
 * A prerender issues a real navigation request. Measured on production
 * 2026-08-23: the public documents and their `.data` twins answer
 * `public, s-maxage=600` with `Vary: Cookie` to a cookieless request, and
 * `private, no-store` with `CF-Cache-Status: BYPASS` to any request carrying a
 * cookie, which is the cookieless-only rule in `workers/app.ts`. So a
 * cookie-carrying reader's speculation is an ORIGIN hit that a no-store
 * response cannot leave in the HTTP cache. It is spent on the prerender's own
 * document, which the browser keeps in memory and swaps in on activation, and
 * it is discarded if the reader never clicks. That is the honest trade and it
 * is bounded by the two-prerender cap above.
 *
 * ## IT CARRIES A CSP NONCE
 *
 * `script-src` gates `type="speculationrules"` and does NOT gate
 * `type="application/ld+json"`. That asymmetry is the browser's, was measured
 * rather than reasoned, and the full record is in `blog-speculation.tsx`. Do
 * not remove this nonce for consistency with the JSON-LD blocks.
 *
 * The nonce comes from the root loader, read OPTIONALLY: on the error-boundary
 * path the root loader never ran, and an enforcing policy then drops this
 * enhancement on an error page and nothing else.
 */
const RULES = JSON.stringify({
  prerender: [{ urls: [...HEADER_PATHS], eagerness: "moderate" }],
});

export function SiteSpeculation() {
  const data = useRouteLoaderData<typeof rootLoader>("root");

  return (
    <script
      type="speculationrules"
      nonce={data?.nonce}
      dangerouslySetInnerHTML={{ __html: RULES }}
    />
  );
}
