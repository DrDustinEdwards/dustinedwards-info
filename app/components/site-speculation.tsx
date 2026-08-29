import { useLocation, useRouteLoaderData } from "react-router";

import { buildSpeculationRules } from "~/lib/speculation.mjs";

import type { loader as rootLoader } from "~/root";

/**
 * Speculation Rules for the whole public plane, on every public page.
 *
 * It rides in `SiteHeader`, so its scope is exactly "wherever the header is":
 * the public routes plus the root error boundary, and never the admin plane,
 * which has its own shell and does not render `SiteHeader`.
 *
 * **THE PAYLOAD IS BUILT BY `~/lib/speculation.mjs`, WHICH IS THE ONE OWNER OF
 * THE RULE SHAPE AND THE EXCLUSIONS.** Read it for what is excluded and why,
 * for the two eagerness budgets, and for what `immediate` costs. This file owns
 * only the two things a module cannot: the nonce and the location.
 *
 * **IT REPLACED `BlogSpeculation` on 2026-08-28.** That component carried a
 * second `speculationrules` block on the two blog routes, scoped to `/blog/*`.
 * Its whole subject is now inside the document rule here, and two blocks on one
 * page meant two rule sets competing for one budget.
 *
 * ## IT CARRIES A CSP NONCE
 *
 * `script-src` gates `type="speculationrules"` and does NOT gate
 * `type="application/ld+json"`. Both are non-executable data blocks in a
 * `<script>` element, so the expectation is that either both are gated or
 * neither is; the browser disagrees. Measured 2026-08-06 across ten violation
 * reports, all `script-src-elem`: `/` carried two un-nonced `ld+json` blocks and
 * was not reported, while the pages carrying a speculationrules block were.
 * Do not "consistently" add a nonce to the JSON-LD or remove this one; the
 * asymmetry is the browser's, and the full record is in `VERIFICATION.md`.
 *
 * Under an ENFORCED policy an un-nonced block is refused SILENTLY: the page
 * renders identically, nothing is logged where anyone looks, and the whole
 * enhancement is simply absent on every public page.
 *
 * The nonce comes from the root loader, read OPTIONALLY: on the error-boundary
 * path the root loader never ran, and an enforcing policy then drops this
 * enhancement on an error page and nothing else.
 *
 * ## WHAT A SPECULATION COSTS A COOKIE-CARRYING READER, stated rather than assumed
 *
 * A speculation issues a real, CREDENTIALED request. Measured on the wire: a
 * `prefetch` rule sends `Sec-Purpose: prefetch` and carries the reader's
 * `Cookie`, so it resolves the same theme as the click will and reads or warms
 * the same `caches.default` entry keyed by URL plus resolved theme. That is
 * what makes this a warm-up rather than a duplicate render. Because the reader
 * carries a cookie, the response is `private, no-store` and the PLATFORM cache
 * stores nothing for them (rule 8), so the request reaches this Worker either
 * way; `x-theme-cache` on the wire says whether it rendered.
 *
 * The action was `prerender` until 2026-08-28 and the cost was the same shape,
 * with `Sec-Purpose: prefetch;prerender`. Why it changed is the action section
 * in `~/lib/speculation.mjs`, which is the one owner of that reasoning.
 *
 * ## WHAT NO AUTOMATED GATE CAN SEE HERE, measured 2026-08-28
 *
 * **Chrome refuses to prerender while CDP is attached.** Driving this site
 * under Puppeteer, `Preload.prerenderStatusUpdated` reported every attempt as
 * `Failure [PrerenderingDisabledByDevTools]` and Chrome fell back to prefetch:
 * `deliveryType` read `navigational-prefetch` and `activationStart` was 0 on
 * every run. It is CDP itself and not the Preload domain, confirmed by running
 * the same navigation with the domain disabled and getting the same result.
 *
 * **That is why the blink investigation had to leave CDP entirely**, and why
 * the measurement behind the prefetch ruling is a screen capture rather than a
 * trace. It also still bounds this gate: `check:browser` can assert that the
 * rules are PRESENT, well-formed, accepted and which ACTION they name, and it
 * cannot assert what the browser did on activation. Do not write that
 * assertion; it will pass vacuously or fail forever.
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
