import { useLocation, useRouteLoaderData } from "react-router";

import { buildSpeculationRules } from "~/lib/speculation.mjs";

import type { loader as rootLoader } from "~/root";

/**
 * Speculation Rules for the whole public plane, on every public page. It rides in
 * `SiteHeader`, so its scope is exactly "wherever the header is" and never the
 * admin plane.
 *
 * THE PAYLOAD IS BUILT BY `~/lib/speculation.mjs`, the one owner of the rule shape
 * and the exclusions. This file owns only the two things a module cannot: the
 * nonce and the location.
 *
 * IT CARRIES A CSP NONCE. `script-src` gates `type="speculationrules"` and does
 * NOT gate `type="application/ld+json"`. Both are non-executable data blocks, so
 * the expectation is that either both are gated or neither is; the browser
 * disagrees. Do not "consistently" add a nonce to the JSON-LD or remove this one.
 * Under an ENFORCED policy an un-nonced block is refused SILENTLY.
 *
 * WHAT A SPECULATION COSTS A COOKIE-CARRYING READER: a real, CREDENTIALED request.
 * It carries the reader's `Cookie`, so it resolves the same theme the click will
 * and warms the same entry, which is what makes it a warm-up rather than a
 * duplicate render.
 *
 * WHAT NO AUTOMATED GATE CAN SEE HERE: Chrome refuses to prerender while CDP is
 * attached, and falls back to prefetch. `check:browser` can assert the rules are
 * present, well-formed, accepted and which ACTION they name; it cannot assert what
 * the browser did on activation. Do not write that assertion; it will pass
 * vacuously or fail forever.
 */
export function SiteSpeculation() {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const { pathname } = useLocation();
  const rules = buildSpeculationRules({ pathname });

  return (
    <script
      type="speculationrules"
      nonce={data?.nonce}
      dangerouslySetInnerHTML={{ __html: rules }}
    />
  );
}
