import { useLocation, useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "~/root";

/**
 * Speculation Rules for blog navigation.
 *
 * A declarative JSON payload, not executable script: browsers that do not
 * support it ignore the element entirely, and nothing on the page depends on
 * it. Scoped to /blog links so the browser never speculates about the admin
 * plane or the retired PDF URLs.
 *
 * `moderate` eagerness prefetches on hover rather than eagerly on render, which
 * keeps this from becoming a crawler that costs the reader bandwidth.
 *
 * ## IT CARRIES A CSP NONCE, AND THE REASON IS COUNTER-INTUITIVE
 *
 * **`script-src` DOES gate `type="speculationrules"`, and does NOT gate
 * `type="application/ld+json"`.** Both are non-executable data blocks in a
 * `<script>` element, so the obvious expectation is that either both are gated
 * or neither is. The browser disagrees.
 *
 * That is measured rather than reasoned, and it is precisely why the CSP shipped
 * Report-Only first instead of being argued about. In the 2026-08-06
 * observation window, `/` carries two un-nonced `ld+json` blocks on line 1 and
 * line 1 was NOT reported; `/blog` carries an un-nonced `ld+json` AND this
 * script on line 1, and line 1 WAS reported. The blog post pages isolate it
 * further: their `ld+json` sits alone on line 1 and never reported, while this
 * script on line 53 did. Ten reports total, all `script-src-elem`.
 *
 * So this element needs a nonce and the `ld+json` blocks do not. Do not
 * "consistently" add one to the JSON-LD or remove this one; the asymmetry is
 * the browser's, not a mistake in this file.
 *
 * The nonce comes from the root loader through `useRouteLoaderData`, the same
 * channel `Layout` uses for the theme and the nonce it hands `<Scripts>`. One
 * source in `workers/app.ts`, several readers.
 */
/**
 * THE CURRENT POST IS EXCLUDED FROM ITS OWN RULE, since 2026-08-27.
 *
 * `href_matches: "/blog/*"` matches the post the reader is already on, and a
 * post page links to itself: the heading permalinks, the copy-link action and
 * the canonical all carry that href. Speculating it cannot save a navigation
 * that will never happen, and on this site it costs an ORIGIN request for any
 * reader carrying a cookie. Chrome's two-prerender cap makes it worse than
 * free: the useless speculation can evict a useful one.
 *
 * A third `not` clause rather than a different rule shape, so the exclusion
 * reads beside the `.md` one it sits next to and both are the same mechanism.
 *
 * @param pathname
 */
function rulesFor(pathname: string) {
  return JSON.stringify({
    prerender: [
      {
        where: {
          and: [
            { href_matches: "/blog/*" },
            { not: { href_matches: "/blog/*.md" } },
            { not: { href_matches: pathname } },
          ],
        },
        eagerness: "moderate",
      },
    ],
  });
}

export function BlogSpeculation() {
  // Optional data, for the reason Layout reads it optionally: on the error
  // boundary path the root loader never ran. No nonce then, which under an
  // enforcing policy costs this enhancement on an error page and nothing else.
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const { pathname } = useLocation();

  return (
    <script
      type="speculationrules"
      nonce={data?.nonce}
      dangerouslySetInnerHTML={{ __html: rulesFor(pathname) }}
    />
  );
}
