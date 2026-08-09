import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext, nonceContext } from "~/lib/context";
import { handleMediaEvents } from "./media-events";

// Re-exported so the runtime can find the class its binding names. The Ask
// spend ceiling lives in a Durable Object rather than KV because it has to be
// exact; the measurement that settled it is in the file.
export { AskBudget } from "./ask-budget";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

/**
 * What a response gets when it never said what it wanted.
 *
 * `cache.enabled` in wrangler.jsonc puts Workers Cache in FRONT of this Worker,
 * and it was turned on for one reason: Images binding responses are not cached
 * by Cloudflare, so every `/media/<key>?w=` was paying a full decode and
 * re-encode. But the switch is top level, not per binding, and it governs every
 * response this Worker returns.
 *
 * The trap is that omitting Cache-Control is NOT opting out. Cloudflare applies
 * RFC 9111 heuristic freshness to a response carrying no Cache-Control and no
 * Expires, which caches a 200 for two hours and a 404 for three minutes. The
 * cache key is the path, the entrypoint and the Worker version; COOKIES ARE NOT
 * IN IT. Only three routes on this site export `headers`, so without this the
 * first authenticated /admin render would be stored and then served to anyone
 * who asked for that path for the next two hours. That is an auth bypass, not a
 * performance regression.
 *
 * So the default is the refusal, and a route opts IN by setting the header
 * itself. Fail closed, in one place: a route added later is uncached until
 * somebody decides otherwise, which is the same stance `publiclyVisible()` and
 * the Ask guards take. `private` alone would satisfy Cloudflare's edge;
 * `no-store` is added so intermediaries and the browser treat it the same way.
 */
const UNCACHED = "private, no-store";

/**
 * Security headers, on EVERY response. Ratified 2026-08-06 (Phase A).
 *
 * Same shape and the same reason as `UNCACHED`: one constant, applied on the
 * way out, so a route added later is covered without anyone remembering. A
 * per-route opt-in would mean the next route ships bare, which is exactly how
 * the site ended up sending none of these at all.
 *
 * **PHASE A IS THE STATIC SET ONLY.** There is deliberately no
 * Content-Security-Policy here. A useful CSP needs a per-response nonce, which
 * has to exist BEFORE the render so `<Scripts nonce>` can stamp it, so it
 * cannot be a pure exit-path header the way these are. That is Phase B, its own
 * ruling and its own commit, and it starts in Report-Only.
 *
 * Three of these look tightenable and are not. The reasoning is not recoverable
 * from the values, so it is written here rather than left for someone to
 * rediscover by breaking something:
 *
 * - **`Cross-Origin-Resource-Policy: cross-origin`, NOT `same-origin`.**
 *   `same-origin` would block social platforms from fetching `og:image` out of
 *   `/media/og/*`, and link previews would silently stop working. The failure
 *   is off-site and invisible from here, which is the worst combination. This
 *   is the one header where the restrictive value is the WRONG value.
 *
 * - **`Cross-Origin-Opener-Policy: same-origin-allow-popups`. KEPT ON PURPOSE.
 *   Do not tighten to `same-origin`.** Ruled 2026-08-06, after the question was
 *   settled rather than while it was open.
 *
 *   Better Auth's Google flow is the only cross-origin window interaction on
 *   the site, and it is a TOP-LEVEL REDIRECT, not a popup: `redirectPlugin` in
 *   `better-auth/dist/client/fetch-plugins.mjs` sets `window.location.href`,
 *   there is NO `window.open` anywhere in the client package, and `/login`
 *   renders a `<button type="button">` whose onClick calls `signIn.social`.
 *   Established by reading the SHIPPED CLIENT CODE, not by executing sign-in,
 *   which needs credentials.
 *
 *   So `same-origin` would work today, and it is still not what we want. The
 *   permissive notch is insurance against DEPENDENCY DRIFT: Better Auth can
 *   move to a popup on a version bump with nobody re-reading `redirectPlugin`,
 *   and the failure mode would be a silent sign-in break on the one door into
 *   the private plane. Tightening buys nothing measured here and costs that.
 *
 *   **This is a settled question, not an open one.** The earlier note here said
 *   the flow was unverified; that was true when it was written and is false
 *   now. Reopening it needs new evidence about the flow, not a fresh reading of
 *   the same code.
 *
 * - **No `includeSubDomains`, no `preload` on HSTS.** This is a `workers.dev`
 *   subdomain whose parent domain we do not own, and asserting a policy for it
 *   is not ours to make. Revisit for the apex at DNS cutover.
 *
 * - **`X-Frame-Options: DENY` is a LEGACY MIRROR of `frame-ancestors`,** which
 *   does not exist until Phase B ships a CSP. Delete this line only when Phase
 *   B is enforcing, never before, or the site spends that window framable.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

/** @param headers the response headers to stamp, mutable or a fresh copy */
function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

/** Where violation reports are POSTed. Also declared in `routes.ts`. */
const CSP_REPORT_PATH = "/api/csp-report";

/** The `Reporting-Endpoints` name that `report-to` refers to. */
const CSP_ENDPOINT_NAME = "csp-endpoint";

/**
 * The Phase B policy, REPORT-ONLY. Ratified 2026-08-06.
 *
 * **This header enforces NOTHING.** It is `Content-Security-Policy-Report-Only`
 * on purpose. It shipped that way because three questions could not be answered
 * by reading and were deliberately left to the browser rather than to argument.
 *
 * **ALL THREE ARE NOW ANSWERED. None of them blocks enforcement.** They are kept
 * here with their answers because the answers are the reason the phase split was
 * worth its cost, and because two of them are counter-intuitive enough that
 * somebody will otherwise re-derive them wrongly.
 *
 *   1. **RESOLVED 2026-08-06: `'strict-dynamic'` DOES cover ES module static
 *      imports.** The router's nonced `type="module"` script imports every route
 *      chunk from `/assets/`, MDN documents the case neither way, and if it did
 *      not propagate an enforcing policy would take the whole site's JavaScript
 *      with it. The observation window settled it, and it was EXERCISED rather
 *      than merely silent: no report named an `/assets/` URL, and the app
 *      demonstrably hydrated, with `/__manifest` fetched, the Ask panel
 *      streaming and the palette working. Silence alone would not have been
 *      evidence, because a policy that blocked everything reports once and then
 *      has nothing left to report.
 *      **What would reopen it:** a Vite or React Router change to how the entry
 *      script loads chunks (a dynamic `import()` chain behaves differently from
 *      a static graph), or a browser dropping `'strict-dynamic'` propagation.
 *      Re-run the walk; do not re-reason it.
 *   2. **RESOLVED 2026-08-06: `script-src` does NOT gate
 *      `<script type="application/ld+json">`, and DOES gate
 *      `type="speculationrules"`.** Both are non-executable data blocks, so the
 *      asymmetry is the browser's rather than a mistake here. Established by
 *      CONTRAST, not absence: `/` carries un-nonced `ld+json` on line 1 and line
 *      1 was not reported, while `/blog` carries `ld+json` AND speculationrules
 *      on line 1 and line 1 WAS reported. The JSON-LD stays un-nonced; grounds
 *      are on `BlogSpeculation`.
 *   3. **RESOLVED 2026-08-07: the nonce plumbing lands on every generated
 *      script.** It did not, when this was written: React Router's two streaming
 *      scripts shipped bare on every page, which is what 10 of the 10 reports
 *      were. Fixed by passing `nonce` to `<ServerRouter>`; see `entry.server.tsx`.
 *      Now asserted on the wire.
 *
 * **THE ONLY THING BLOCKING ENFORCEMENT IS THE SHARED-CACHE NONCE LIFETIME
 * BELOW.** Do not cite this list as a reason; it was one until 2026-08-07 and is
 * not one now.
 *
 * `style-src-attr 'unsafe-inline'` is NOT laziness and must not be "fixed".
 * Measured: 117 inline `style="--shiki-light:…"` attributes on one live post,
 * emitted by the highlighting pipeline. Nonces do not apply to style
 * ATTRIBUTES, and hashing 117 per page is not a real option. CSP Level 3 splits
 * `style-src-attr` from `style-src` precisely so scripts can stay strict while
 * attributes are permitted, which is the trade taken here.
 *
 * **THE SOLE ENFORCEMENT BLOCKER: a nonce and a SHARED CACHE. MEASURED.**
 * Six HTML routes are `public, s-maxage=600` for cookieless readers, so the
 * header and the body are cached together.
 *
 * Measured on the live site 2026-08-09, which is the half nothing had ever
 * checked:
 *
 *   4 cookieless requests on a cache HIT   ->  1 DISTINCT NONCE
 *   4 cookie-bearing requests on BYPASS    ->  4 distinct nonces
 *   the cached body carries the cached header's nonce
 *
 * So the per-request generator is working exactly as intended, and the CACHE is
 * what collapses it. The policy stays internally consistent, which is why
 * nothing looks wrong and why this is easy to miss, but **on those six routes an
 * attacker who reads one page holds a valid nonce for up to ten minutes**, which
 * is precisely the guarantee an enforcing policy would be relying on.
 *
 * It changes nothing in Report-Only, which is why it was not solved when found.
 * It must be RULED ON BEFORE the switch, and there are two acceptable answers:
 * accept the ten-minute window in writing with the reasoning recorded, or make
 * those six routes uncacheable and give back the shared-cache benefit. DNS
 * cutover changes the terms, because a proxied zone brings Cache Rules into
 * scope. `verify-live` asserts the measurement above so the number cannot drift
 * unnoticed while the decision is pending.
 *
 * `report-uri` AND `report-to` are both sent, per MDN: "The `report-to`
 * directive is intended to replace `report-uri`, and browsers that support
 * `report-to` ignore the `report-uri` directive. However, until `report-to` is
 * broadly supported you can specify both." `report-to` is Baseline 2026 and
 * `Reporting-Endpoints` Baseline 2024, so both are recent enough that the
 * legacy directive is still carrying real browsers.
 *
 * @param nonce the per-request nonce, already in the render context
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_ENDPOINT_NAME}`,
  ].join("; ");
}

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });

    /*
     * THE NONCE, GENERATED BEFORE THE RENDER. This is the deviation.
     *
     * Everything else in this file is stamped onto a finished response and
     * needs to know nothing about it. A nonce cannot be: the identical value
     * has to reach the header AND every `<script>` in the body, so it is
     * created here, put in the render context, and read back out below to build
     * the policy. Grounds are on `nonceContext` in `app/lib/context.ts`.
     *
     * `crypto.randomUUID()` is fresh per request and never derived from
     * anything stable. **A static or derived nonce is the failure mode that
     * looks exactly like success:** every page renders, nothing reports, and
     * the policy is worth nothing, because an attacker who can read one page
     * can reuse the value. verify-live asserts two responses differ, which is
     * the only place that can be seen.
     */
    const nonce = crypto.randomUUID();
    context.set(nonceContext, nonce);

    const response = await requestHandler(request, context);

    // THE COOKIELESS-ONLY RULE.
    //
    // A route that sets `Vary: Cookie` is declaring that its body depends on the
    // Cookie header and that it wants to be shared-cached. `Vary` alone is not
    // enough to make that safe here, and the reason is measured rather than
    // assumed: an ABSENT Cookie header is not treated as its own variant, so a
    // cookieless request matches whatever variant is already stored. With
    // `theme=dark` warming the entry first, every first-time visitor was served
    // a dark document. Present-but-different cookie values DO separate; absent
    // does not. Full matrix in Capsid `dustinedwards/workers-cache-vary.md`.
    //
    // So the response to any request that CARRIES a cookie is downgraded and
    // never stored. The only variant that can ever exist is the cookieless one,
    // which is correct for exactly the readers who match it, and the broken
    // direction is never exercised. That makes the order-dependence structurally
    // impossible instead of avoided by luck.
    //
    // Keyed on the PRESENCE of any cookie, not on a theme cookie. If it looked
    // for `theme=` specifically, a request carrying only a Better Auth session
    // cookie would count as cookieless and its response would be stored as the
    // shared variant, leaking anything session-dependent to everyone. Presence
    // is the fail-closed reading.
    //
    // Scoped by the response's own `Vary`, so it touches only routes that opted
    // in. The feeds and the markdown twins stay publicly cached for every reader
    // because they do not vary on Cookie and do not carry the header.
    /*
     * ALL response-level policy, in ONE place with ONE immutable fallback.
     *
     * `Response.redirect()` and friends return immutable headers, so a `set`
     * throws rather than being quietly ignored, and rebuilding is the only way
     * to stamp them. Rebuilding stays on the catch branch rather than becoming
     * the general path: routing every response through a new one is pointless
     * work on the routes that stream.
     *
     * **The cookieless downgrade moved INSIDE this block**, and that is not
     * tidying. It used to run unguarded above, so on an immutable response it
     * would throw and take the whole request with it, and the security headers
     * below would never be reached. A security header set that can be skipped
     * by an exception on the line before it is not applied to every response,
     * which is the one property this block exists to have. Both halves now
     * share the fallback: whatever throws, the rebuild applies everything.
     *
     * `/admin` returning 302 is the live case, and it carries no `Vary`, so it
     * reaches only the cache-control default. It is asserted in verify-live
     * anyway, because it is a DIFFERENT code branch from a 200.
     */
    const varies = response.headers.get("vary") ?? "";
    const downgradeForCookie =
      request.headers.has("cookie") && /(^|,)\s*cookie\s*(,|$)/i.test(varies);

    // Absolute, because `Reporting-Endpoints` takes a URL and MDN notes that
    // non-secure endpoints are ignored. Derived from the request so it is
    // correct on workers.dev today and on the apex after cutover, with nothing
    // to add to the cutover list.
    const reportTo = `${CSP_ENDPOINT_NAME}="${new URL(request.url).origin}${CSP_REPORT_PATH}"`;
    const csp = contentSecurityPolicy(nonce);

    try {
      if (downgradeForCookie) response.headers.set("cache-control", UNCACHED);
      applySecurityHeaders(response.headers);
      response.headers.set("Reporting-Endpoints", reportTo);
      response.headers.set("Content-Security-Policy-Report-Only", csp);
      if (!response.headers.has("cache-control")) {
        response.headers.set("cache-control", UNCACHED);
      }
    } catch {
      const headers = new Headers(response.headers);
      if (downgradeForCookie) headers.set("cache-control", UNCACHED);
      applySecurityHeaders(headers);
      headers.set("Reporting-Endpoints", reportTo);
      headers.set("Content-Security-Policy-Report-Only", csp);
      if (!headers.has("cache-control")) headers.set("cache-control", UNCACHED);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },

  /**
   * R2 event notifications from `dustinedwards-media`, deriving the D1 index.
   *
   * Separate from `fetch` on purpose: no HTTP request ever triggers this, and no
   * reader ever waits on it. The grounds and the idempotency argument are in
   * `media-events.ts`.
   */
  async queue(batch, env) {
    await handleMediaEvents(batch, env);
  },
} satisfies ExportedHandler<Env>;
