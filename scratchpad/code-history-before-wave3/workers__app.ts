import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";

import { analyticsPath } from "~/lib/analytics-path.mjs";
import { cloudflareContext, nonceContext } from "~/lib/context";
import { httpsRedirectStatus, httpsRedirectTarget } from "~/lib/https-redirect.mjs";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { postRedirectStatus, postRedirectTarget } from "~/lib/slug-redirect.mjs";
import {
  paperSlashTarget,
  pdfRedirectStatus,
  pdfRedirectTarget,
} from "~/lib/publications/pdf-redirect.mjs";
/*
 * The redirect map, imported here rather than inside the predicate. The
 * grounds are on `slug-redirect.mjs`: a bare JSON import is what compiles in
 * this repo and what Node ESM refuses, so the `.mjs` module that `node --test`
 * loads directly cannot do it and this `.ts` module can.
 */
import redirects from "../content/redirects.json";
import { themeFromRequest } from "~/lib/theme";
import { serverTiming, timingsContext } from "~/lib/timing";
import {
  CSP_ENDPOINT_NAME,
  CSP_REPORT_PATH,
  contentSecurityPolicy,
  isAdminPath,
} from "./csp.mjs";
import { isFeed } from "./feed-types.mjs";
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
 * WHAT THE CACHE KEY IS, now that the platform can hold the whole dimension.
 *
 * ## THE LAYER THIS REPLACES, and the measurement that justified both
 *
 * Until 2026-09-05 this file ran a SECOND cache by hand, in `caches.default`,
 * keyed on a synthetic `__theme` and `__build` query parameter. It existed for
 * one reason, recorded here because the reason is the whole arc: the platform's
 * key was the entrypoint, path, query and Worker version, and nothing this
 * Worker could do put the theme into it. So public HTML declared `Vary: Cookie`,
 * every cookie-bearing reader was downgraded to `private, no-store`, and the
 * platform stored only the cookieless variant.
 *
 * The cost of that, measured on the wire 2026-08-26:
 *
 *     no cookie        HIT
 *     theme=dark       BYPASS   private, no-store
 *     _ga=1            BYPASS   private, no-store
 *
 * A reader who touched the theme toggle, which is the site's own feature, or
 * who carried any analytics cookie at all, paid a full origin render on every
 * click. On the throttled profile the audits used, 1.2 s against 2.0 s to first
 * paint on the home page. The hand-built layer bought that back for cookied
 * readers and could not be tiered, could not collapse concurrent requests, and
 * could not be purged: `caches.default` is per data centre, which is why
 * ruling 7 refused to invalidate on approve at all.
 *
 * ## WHAT CHANGED, 2026-09-05 (decisions vol 14, rulings 10, 11, 15 and 16)
 *
 * Workers Cache now takes `ctx.props` into the key, and a gateway entrypoint
 * can call a renderer entrypoint through `ctx.exports` with an explicit
 * `cf.cacheKey`. So the theme goes in the key the platform itself owns, and
 * every reader, cookied or not, gets the tiered, request-collapsing,
 * PURGEABLE cache. Cloudflare's own guidance is to prefer this over
 * `caches.default`, which does none of those three.
 *
 * **THE PLATFORM CACHE IS NOW THE ONLY CACHE.** `caches.default` is not used
 * anywhere in this file. If you are reading this because you are about to add a
 * second one, the thing to know is that the first one was deleted on purpose.
 *
 * ## THE DIMENSION IS IN BOTH HALVES OF THE KEY, and one of those is enough
 *
 * `ctx.props` is in the key by construction and cannot be dropped; a custom
 * `cf.cacheKey` REPLACES the path and query and is honoured only for
 * same-account loopback calls. So passing the theme in props alone would be
 * sufficient, and the docs say so in as many words. It goes in both because the
 * pair is what this function returns and what the tests read: a key string that
 * did not mention the theme would make the pure function's output a poor
 * description of the real key, and the next reader would have to know the props
 * rule to see the dimension at all.
 *
 * ## The old layer's own measurement is still what licenses this
 *
 * The theme is the ONLY thing read off the cookie. `check:browser` proves, on
 * every route that declares the shared cache headers, that a credentialed
 * reader gets byte-identical HTML and that the theme changes only the
 * `data-theme` attribute and the colour-scheme meta. If that stops being true
 * the gate goes red before this becomes a leak. That assertion did not change
 * with the cache under it, and it is the reason this key is allowed to be as
 * short as it is.
 */
export type RendererProps = { theme?: string };

/**
 * The cache key and the props for one request. PURE, so it can be tested.
 *
 * `URL` builds the key so the separator is handled: a path that already carries
 * a query string keys correctly instead of producing a second `?`. That detail
 * outlived the layer it was written for.
 *
 * THE THEME DIMENSION IS ADDED ONLY WHERE A DOCUMENT COULD CARRY IT. A GET, not
 * an admin path, not a request negotiating away from HTML. Admin responses are
 * `private, no-store` by their own declaration and are never stored whatever
 * the key says, so this is belt and braces there; the negotiated case is not,
 * and the grounds are on `negotiatesAwayFromHtml`.
 *
 * @param url     the request URL, already parsed by the caller
 * @param request the incoming request, for its method and Accept
 * @param theme   the resolved theme, one of the three `Theme` values
 */
export function cacheDimensions(
  url: URL,
  request: Request,
  theme: string,
): { cacheKey: string; props: RendererProps } {
  const themed =
    request.method === "GET" &&
    !isAdminPath(url.pathname) &&
    !negotiatesAwayFromHtml(request);

  if (!themed) return { cacheKey: `${url.pathname}${url.search}`, props: {} };

  const keyUrl = new URL(url);
  keyUrl.searchParams.set("theme", theme);
  return { cacheKey: `${keyUrl.pathname}${keyUrl.search}`, props: { theme } };
}

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
 * ruling and its own commit. It started in Report-Only and is enforced as of
 * 2026-08-17.
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
 *
 * ## THE PERMISSIONS-POLICY LIST IS DERIVED, and the derivation is the value
 *
 * Widened 2026-08-23 from the original four. The four were right and were also
 * the shape of a copied snippet, which is a bad way for a list like this to be
 * correct: nothing recorded what the site actually uses, so the next person to
 * "improve" it had no way to tell a safe addition from a breaking one.
 *
 * **WHAT THE SITE USES: `clipboard-write`, AND IT MUST NEVER BE DENIED HERE.**
 * Measured across `app/` and `workers/` on 2026-08-23. It is on the PUBLIC
 * plane, not just the admin one: `app/enhance/blog.ts` calls
 * `navigator.clipboard.writeText` three times, for the copy-code button on
 * every fenced block, the copy-link on heading permalinks, and the copy-markdown
 * control. Four admin components use it as well. Denying `clipboard-write`
 * would break the copy button on every blog post, and it would break it
 * SILENTLY, because the enhancement already swallows a refusing clipboard.
 * That is the exact trap a longer copied snippet walks into.
 *
 * **WHAT THE SITE DOES NOT USE, verified by the same sweep and therefore denied:**
 * no `getUserMedia` or `navigator.mediaDevices` (camera, microphone,
 * display-capture), no `navigator.geolocation`, no `PaymentRequest`, no
 * `navigator.usb`, `navigator.serial`, `navigator.bluetooth` or MIDI access.
 * Zero matches for any of them.
 *
 * Kept OUT of the list deliberately, rather than forgotten: the motion sensors,
 * `fullscreen`, `autoplay` and the rest of the registry. They are unused too,
 * but each additional token is a value `check:headers` and `verify-live` must
 * both carry, and denying a feature nothing can reach buys nothing. The five
 * added are the ones where a future dependency reaching for them silently would
 * actually matter.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  // ONE STRING LITERAL, never a concatenation. `check:headers` and
  // `verify-live` both parse this object with a `"name": "value"` regex, so a
  // `+`-joined value would parse as its FIRST fragment only: the gate would
  // compare half a header and the wire check would then fail against the whole
  // one. Same trap `check:invariants` already had to join literals to survive.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

/*
 * `cookieDowngrade` WAS DELETED HERE, 2026-09-05, and it is worth one note.
 *
 * It answered "does this response have to be downgraded because the request
 * carried a cookie", and it decided by reading the response's own `Vary`. That
 * scoping was the whole function: a route that did not vary on Cookie was never
 * downgraded, which is what kept the feeds public.
 *
 * NOTHING VARIES ON COOKIE NOW, so the predicate could only ever answer false.
 * A guard whose condition cannot be met is worse than no guard: it reads as
 * protection and is not. The downgrade it served survives in the gateway,
 * decided from the response's declared cache-control instead, which is a
 * condition that can actually be true.
 */

/** @param headers the response headers to stamp, mutable or a fresh copy */
function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

/**
 * The Phase B policy, ENFORCED since 2026-08-17. Ratified 2026-08-06.
 *
 * **THIS HEADER NOW BLOCKS.** It is `Content-Security-Policy`, not
 * `-Report-Only`, and reporting stays on beside it. It spent its first eleven
 * days reporting because three questions could not be answered by reading and
 * were deliberately left to the browser rather than to argument.
 *
 * **WHAT WAS DRIVEN BEFORE THE SWITCH, because an enforced policy that blocks
 * something is worse than Report-Only.** Eighteen routes, real navigations,
 * counting the browser's own `report-uri` POSTs: ten public under the ENFORCED
 * header locally (`/`, `/blog`, a post, `/colophon`, `/projects`,
 * `/playground` with all three demos, `/phage-discovery`, `/search` with the
 * palette opened, `/login`, and a 404 through the error boundary) and eight
 * admin on production, where the policy content is byte-identical (`/admin`,
 * media in grid view, posts, the CodeMirror editor, origin-requests, tools,
 * content, sites). **Zero violations on every one, and every one hydrated.**
 * Two apparent image failures were chased down and were lazy loading, not
 * blocking: forced eager, 9 of 9 loaded on both.
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
 * `style-src-attr 'unsafe-inline'` is deliberate and must not be "fixed". The
 * measurement and the reasoning are on the directive itself, in `./csp.mjs`,
 * which is the only copy.
 *
 * **THE SOLE ENFORCEMENT BLOCKER: a nonce and a SHARED CACHE. MEASURED.**
 * The shared-cacheable public HTML routes are `public, s-maxage=600` for
 * cookieless readers, so the header and the body are cached together.
 *
 * **THE LIST IS NOT REPEATED HERE, AND THAT IS DELIBERATE.** `check:headers`
 * owns it in both directions: every .tsx route referencing the shared string
 * must be named there, and every name there must still reference it.
 *
 * A count in this paragraph had been wrong three times over, in two files at
 * once, and it also called `/projects` `private, no-store` when that route in
 * fact exported no `headers()` at all and fell through to hard rule 8's
 * uncached default. Hard rule 8 names this habit; this paragraph is where it
 * cost the most.
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
 * nothing looks wrong and why this is easy to miss, but **on every
 * shared-cached route an attacker who reads one page holds a valid nonce for up
 * to ten minutes**, which is precisely the guarantee the enforcing policy IS
 * relying on.
 *
 * **RULED 2026-08-17, and the first answer was taken.** The two acceptable
 * answers were to accept the ten-minute window in writing with the reasoning
 * recorded, or to make those routes uncacheable and give back the
 * shared-cache benefit. Accepted, and recorded PUBLICLY rather than in a comment:
 * `app/lib/colophon-sections.mjs` states it in plain language on /colophon, on
 * the grounds that a showcase listing only its wins is an advertisement. The
 * reasoning is that the alternative makes every reader wait for the origin, and
 * that it is acceptable only because these pages carry no writing from anyone
 * but Dustin.
 *
 * **The exposure below is LIVE and accepted, not pending.**
 *
 * **A THIRD ANSWER WAS RULED IN AND THEN FALSIFIED BY MEASUREMENT, 2026-08-17.**
 * The ruling was `script-src 'self'` with `'strict-dynamic'` removed, on the
 * premise that every script here is a first-party bundle under `/assets/`. Half
 * of that is right and the load-bearing half is not:
 *
 *   - RIGHT: `'strict-dynamic'` does cause `'self'` and every allowlist entry
 *     to be IGNORED, so the two genuinely cannot be combined. MDN, verbatim:
 *     "any allowlist or source expressions such as 'self' or 'unsafe-inline'
 *     will be ignored."
 *   - WRONG: there is not one external `<script src>` on this site. MEASURED on
 *     production across `/`, `/blog`, `/playground`, `/search`, `/colophon`,
 *     `/projects` and `/login`: every script element is INLINE, five to seven
 *     per page, and the `/assets/` bundles are reached by an inline `type=module`
 *     script that IMPORTS them. `'self'` does not cover inline script.
 *
 * DRIVEN IN A REAL BROWSER before being rejected, with the current policy as the
 * control on the same page and harness: under `script-src 'self'` enforced,
 * ZERO JavaScript was requested and `window.__reactRouterContext` was undefined,
 * so nothing hydrated; under the current policy the same page fetched 23 scripts
 * and hydrated. Option C would have taken the whole site down.
 *
 * Hashes cannot rescue it either: three of the inline blocks carry per-request
 * loader data, so their content changes every render.
 *
 * **What survives from that ruling and is now GATED: the origin invariant.**
 * Whatever `script-src` becomes, nothing user-writable may serve a script from
 * this origin. `test/upload-contract.test.mjs` refuses an executable type in the
 * upload allowlist, and `check:headers` derives the attachment rule below from
 * that same allowlist so a new script-capable type cannot be added without one. DNS
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
 * **THE BUILDER ITSELF NOW LIVES IN `./csp.mjs`, AND THE MOVE IS A GATE
 * REQUIREMENT RATHER THAN TIDYING.** The policy became CONDITIONAL when the
 * admin plane started needing a style nonce, and `check:headers` could only
 * ever read this file's SOURCE TEXT. Source text can see that two branches
 * exist; it cannot see which one a request gets. A shared module can be
 * IMPORTED and CALLED, so the gate now asserts the strings both branches
 * actually return, and the public branch keeping an absolute `style-src` is a
 * failing assertion rather than an intention recorded in a comment.
 *
 * Everything above about enforcement, the resolved report list and the
 * shared-cache nonce lifetime is unchanged and still describes this policy.
 * The grounds for the admin-only branch are on `contentSecurityPolicy` there.
 */

/**
 * One traffic row per HTML response, into Analytics Engine.
 *
 * NO CLIENT IDENTIFIER, and that is structural rather than a promise. There is
 * no cookie read, no IP, no user agent string, and nothing derived from any of
 * them. Four coarse strings go in and nothing joins two requests together, so
 * the dataset cannot answer "who" even if someone later wants it to.
 *
 * **THAT CLAIM WAS FALSE FOR ONE ROUTE AND THE CORRECTION IS BELOW.** A preview
 * URL carries a capability in its PATH, so `url.pathname` was a per-reviewer
 * identifier and two requests holding the same link did join. Found on
 * production 2026-08-15, on the first real use. The path is redacted before the
 * write now; the sentence above is true again, and it is written down here as a
 * claim that already aged once.
 *
 * WHY THIS CANNOT FAIL A RESPONSE. Two independent guards, because one is not
 * enough. `writeDataPoint` is documented to return immediately with the runtime
 * writing in the background, so it is never awaited and adds no latency; but
 * "returns immediately" is not "never throws", and a missing binding or a
 * malformed point would throw SYNCHRONOUSLY into the request path. The whole
 * body is therefore wrapped, and the catch is deliberately silent: a failed
 * analytics write must never turn a good page into an error, and must never
 * become log noise on every request either.
 *
 * The REFERER is reduced to its host before it is stored. A full referer URL
 * carries paths and query strings from other people's sites, which is exactly
 * the kind of incidental personal data this site has no reason to hold.
 *
 * The DEVICE hint is a single bit off a header the browser volunteers, not a
 * measurement of the client. It is not a fingerprint and cannot be one.
 *
 * @param request  the incoming request
 * @param response the finished response, read for status and content type
 * @param env      the Worker environment carrying the ANALYTICS binding
 * @param url      already parsed by the caller, so this parses nothing twice
 */
function recordTraffic(request: Request, response: Response, env: Env, url: URL) {
  try {
    // HTML only. Assets, the feeds, the markdown twins, /media and the API
    // routes are all traffic, and none of them is a page view.
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return;
    // Errors and redirects are not reads.
    if (response.status !== 200) return;
    // THE OPERATOR IS NOT AN AUDIENCE. The admin plane is one string compare
    // away on a URL the caller already parsed, so it is skipped at write time
    // rather than left for a query to filter later. A panel that counts its own
    // author is worse than no panel.
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return;

    let refererHost = "";
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        refererHost = new URL(referer).hostname;
      } catch {
        refererHost = "";
      }
    }

    const mobile = request.headers.get("sec-ch-ua-mobile");
    const device = mobile === "?1" ? "mobile" : mobile === "?0" ? "desktop" : "unknown";

    /*
     * THE PATH IS REDACTED BEFORE THE WRITE, and this is the one line in the
     * capture that is a security control rather than a data choice.
     *
     * `/preview/<token>` puts a 43-character CAPABILITY in the URL. Writing
     * `url.pathname` verbatim stored it in Analytics Engine and printed it in
     * full on `/admin/origin-requests`, which is exactly what the drawer's
     * six-character truncation exists to prevent. Measured on production
     * 2026-08-15, on the first real use of the feature.
     *
     * **AE ROWS ARE IMMUTABLE.** Rows written before this landed cannot be
     * redacted, deleted or rewritten; they age out with the dataset's
     * retention. The exposure is bounded on two sides and accepted on that
     * basis in decisions vol 6: a token stops working after its seven day TTL
     * whatever the dataset still remembers, and reading the dataset at all
     * needs ANALYTICS_READ_TOKEN, which is a Worker secret.
     *
     * One row per request is unchanged. Only the identifier goes.
     */
    const path = analyticsPath(url.pathname);

    env.ANALYTICS.writeDataPoint({
      blobs: [path, refererHost, (request.cf?.country as string) ?? "", device],
      doubles: [1],
      // Indexes are the SAMPLING KEY. Path is the right one: it keeps the
      // per-path counts this exists to produce meaningful under sampling.
      //
      // The REDACTED path, necessarily. A distinct index per token also
      // fragmented the sampling key space into values that each appeared a
      // handful of times, which is the worst possible shape for a sampling key,
      // so this is the same edit paying twice.
      indexes: [path],
    });
  } catch {
    /* Analytics must never cost a reader their page. */
  }
}

/**
 * THE RENDERER. Everything that produces a document, and the entrypoint the
 * platform is allowed to cache.
 *
 * ## WHY THIS IS A SEPARATE ENTRYPOINT AT ALL
 *
 * Ruled 2026-09-05 (decisions vol 14, ruling 15). Workers Cache is configured
 * per entrypoint, and the two things this Worker does want opposite answers:
 * the traffic row must be written on EVERY request, and the document should be
 * served without running any code at all. One entrypoint cannot do both, and
 * the previous arrangement resolved that by having no cache the Worker could
 * see, which is what the gateway below and this class replace.
 *
 * So `default` is cache DISABLED and runs always; this is cache ENABLED and
 * runs on a miss. The split is the whole design and the config states it in
 * `exports`; the two files cannot drift, because `check:config` compares them.
 *
 * ## WHAT IT MUST NOT DO
 *
 * It must not write the traffic row. On a hit this code does not run, so a
 * count taken here would silently become a count of cache misses, which is a
 * worse instrument than the one item G replaced: it would look like readership
 * and would move with cache behaviour. `recordTraffic` is called by the
 * gateway, after this returns, for exactly that reason.
 *
 * ## WHAT IT STILL OWNS, unchanged from when this was one handler
 *
 * The nonce, the render, the timing header, the security headers, the CSP, the
 * Reporting-Endpoints header, and hard rule 8's uncached default. All of those
 * belong to the DOCUMENT, so they belong in the copy that is stored: a header
 * stamped after the cache would be absent from every hit.
 */
export class Renderer extends WorkerEntrypoint<Env, RendererProps> {
  override async fetch(request: Request): Promise<Response> {
    const env = this.env;
    const ctx = this.ctx;
    /*
     * Parsed once. The CSP's `Reporting-Endpoints` and the admin branch of the
     * policy both read it, and it used to be parsed up at the themed cache
     * lookup, which no longer exists.
     */
    const url = new URL(request.url);

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

    /*
     * THE TIMING HEADER IS STAMPED HERE, and it has to be, because every other
     * place races.
     *
     * `timings` is ONE array shared through context, and the admin layout's
     * middleware is what creates it. Every loader pushes into that same array,
     * and loaders for a matched route run CONCURRENTLY. So a route that stamped
     * `Server-Timing` from inside its own loader was stamping whatever had
     * accumulated at the instant IT finished.
     *
     * MEASURED on production 2026-08-22, four samples each: /admin.data
     * carried `auth_create|auth_getsession|overview_source|loader_total` and
     * had LOST all four of the layout's marks, because the index route's loader
     * is a stub that finished first. /admin/posts.data carried all twelve,
     * because its loader takes ~314ms and the layout had long since pushed.
     * The header's contents depended on which loader won a race, which makes
     * every breakdown read off it wrong in a way that looks like data.
     *
     * Here is the one point where the array is COMPLETE: the handler has
     * returned, so every loader has finished. The per-route stamps still run
     * and are simply overwritten by this one; they are now redundant rather
     * than wrong, and removing them is a separate tidy.
     *
     * The creation of the array is deliberately NOT moved here. It stays in the
     * admin middleware, which is what confines timing to the admin subtree; a
     * request that never asked carries `undefined` and this whole block is
     * skipped, so a public response is byte-identical to what shipped.
     */
    const handlerStart = performance.now();
    const response = await requestHandler(request, context);
    const timings = context.get(timingsContext).timings;
    /*
     * `worker_total` BOUNDS EVERYTHING, and it is the only mark this file adds.
     *
     * The previous session's criterion was that the response path gets no
     * dedicated instrument unless it owned real time, and it does not: the
     * browser-side residual after `loader_total` and `layout_total` measured
     * 25ms at the median over twelve samples, and that figure still includes a
     * network round trip. This is not that instrument. It is an outer bound, so
     * the residual can be read off the header itself instead of reconstructed
     * from PerformanceResourceTiming in a browser, which is what verifying the
     * fix above requires.
     */
    if (timings) {
      timings.push({ name: "worker_total", ms: performance.now() - handlerStart });
    }

    // THE COOKIELESS-ONLY RULE IS GONE, 2026-09-05, and this is what replaced it.
    //
    // What stood here: a route setting `Vary: Cookie` was declaring that its
    // body depends on the Cookie header, and `Vary` alone was not enough to
    // make that safe, because an ABSENT Cookie header is not treated as its own
    // variant. With `theme=dark` warming the entry first, every first-time
    // visitor was served a dark document. Present-but-different cookie values
    // DO separate; absent does not. Full matrix in Capsid
    // `dustinedwards/workers-cache-vary.md`.
    //
    // THAT MEASUREMENT IS STILL TRUE AND NO LONGER APPLIES, because nothing on
    // this site varies on Cookie any more. The theme is in the CACHE KEY, where
    // absence is not a special case: a request with no theme cookie resolves to
    // a theme like any other and keys on it. The whole class of defect the
    // cookieless-only rule was built to avoid was a property of `Vary`, and
    // `Vary` is what went.
    //
    // The downgrade itself SURVIVES and moved to the gateway (ruling 16, kept
    // as belt and braces). It has to be there rather than here: this response
    // is the one the platform STORES, so writing `private, no-store` on it for
    // a cookied reader would mean cookied readers were never cached, which is
    // the regression the whole arc exists to end. The gateway stamps the wire
    // copy after the cache has already stored the public one.
    /*
     * ALL response-level policy, in ONE place with ONE immutable fallback.
     *
     * `Response.redirect()` and friends return immutable headers, so a `set`
     * throws rather than being quietly ignored, and rebuilding is the only way
     * to stamp them. Rebuilding stays on the catch branch rather than becoming
     * the general path: routing every response through a new one is pointless
     * work on the routes that stream.
     *
     * The property this block exists to have is that the security headers are
     * applied to EVERY response, including one whose headers refuse a `set`.
     * Both branches apply the same set; whatever throws, the rebuild covers it.
     *
     * `/admin` returning 302 is the live case. It is asserted in verify-live
     * anyway, because it is a DIFFERENT code branch from a 200.
     */

    // Absolute, because `Reporting-Endpoints` takes a URL and MDN notes that
    // non-secure endpoints are ignored. Derived from the request so it is
    // correct on workers.dev today and on the apex after cutover, with nothing
    // to add to the cutover list. `url` is parsed once, up at the themed cache
    // lookup, because that runs before the render and needs the same value.
    const reportTo = `${CSP_ENDPOINT_NAME}="${url.origin}${CSP_REPORT_PATH}"`;
    /*
     * The style nonce is emitted for the ADMIN PLANE ONLY, keyed on the path.
     * `isAdminPath` owns the exact-or-slash test and the reasoning, including
     * what an unauthenticated request to an admin path gets, which is a
     * bodyless 302 that is never shared-cached.
     */
    const csp = contentSecurityPolicy(nonce, isAdminPath(url.pathname));

    /*
     * `recordTraffic` USED TO BE CALLED HERE AND IS NOW THE GATEWAY'S, 2026-09-05.
     *
     * The old comment argued for this position at length: one call site above
     * two returns, everything it reads already final. All of that was right
     * about this function and is now beside the point, because this function no
     * longer runs on every request. On a cache HIT the platform answers without
     * invoking this entrypoint at all, so a count taken here would have become
     * a count of MISSES the day the cache started working, and would have read
     * like readership while moving with cache behaviour.
     *
     * It moved to the gateway, which is cache disabled and therefore runs
     * always. Ruling 12 is the same observation from the other side: the
     * gateway is what finally makes the count complete.
     */

    /*
     * THE STORE BLOCK IS GONE, 2026-09-05, with the layer it wrote to.
     *
     * It hand-wrote the public document into `caches.default` under three
     * conditions, and each of those is now the platform's own answer rather
     * than this file's:
     *
     *   the route declared the shared string   still the rule, and now it is
     *                                          the only rule. The platform
     *                                          stores what the response says
     *                                          is storable, and hard rule 8's
     *                                          default below is what makes a
     *                                          route that says nothing refuse.
     *   GET, not an admin path                 Workers Cache caches GET and
     *                                          HEAD only, per the docs, and an
     *                                          admin response is `private,
     *                                          no-store` by its own headers.
     *   no Set-Cookie                          documented as an AUTOMATIC
     *                                          bypass. A response that mints a
     *                                          session or a theme is per reader
     *                                          by definition, and the platform
     *                                          refuses to store it without
     *                                          being asked.
     *
     * So the guard that used to be written out here survives as configuration
     * plus two documented platform behaviours. That is a real reduction in
     * things this file can get wrong, and it is the reason to prefer the
     * platform cache rather than a preference for less code.
     */

    try {
      if (timings) response.headers.set("Server-Timing", serverTiming(timings));
      applySecurityHeaders(response.headers);
      response.headers.set("Reporting-Endpoints", reportTo);
      if (!isFeed(response.headers.get("content-type"))) {
        response.headers.set("Content-Security-Policy", csp);
      }
      if (!response.headers.has("cache-control")) {
        response.headers.set("cache-control", UNCACHED);
      }
    } catch {
      const headers = new Headers(response.headers);
      if (timings) headers.set("Server-Timing", serverTiming(timings));
      applySecurityHeaders(headers);
      headers.set("Reporting-Endpoints", reportTo);
      if (!isFeed(headers.get("content-type"))) {
        headers.set("Content-Security-Policy", csp);
      }
      if (!headers.has("cache-control")) headers.set("cache-control", UNCACHED);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  }
}

/**
 * THE GATEWAY. Cache disabled, so it runs on every single request.
 *
 * Ruled 2026-09-05 (decisions vol 14, ruling 15). It does only the four things
 * that must not be skipped, and hands everything else to the `Renderer` above
 * through a loopback the platform is allowed to answer from cache.
 *
 *   1. the HTTPS redirect, before anything is parsed
 *   2. the theme cookie read, which becomes the cache key's one dimension
 *   3. the loopback, with that key and those props
 *   4. the traffic row, AFTER the response comes back, hit or miss
 *
 * ## WHY IT COSTS A WORKER INVOCATION ON EVERY REQUEST, AND WHY THAT IS FINE
 *
 * A cache hit no longer skips this Worker entirely; it skips the RENDERER.
 * Cloudflare bills a request either way and bills CPU time only when code runs,
 * so what this costs is the microseconds of the four steps below. What it buys
 * is ruling 12: `recordTraffic` finally sees every page view rather than only
 * the ones that missed, which is the second half of item G answered by
 * construction rather than by a beacon.
 *
 * ## THE ORDER IS LOAD BEARING
 *
 * The redirect is first because a plaintext request must never reach a cache
 * lookup keyed on a path that ignores the scheme. Everything else follows the
 * response, so the traffic row is written from the finished thing rather than
 * from an intention.
 */
export default {
  async fetch(request, env, ctx) {
    /*
     * PLAINTEXT GOES TO HTTPS BEFORE ANYTHING ELSE HAPPENS.
     *
     * Measured on the live site 2026-08-23: http:// returned 200 with the
     * full page, and the shared cache did not separate the schemes, so a
     * plaintext request was answered with the byte-identical cached HTTPS
     * response INCLUDING ITS CSP NONCE. The grounds, the three consequences
     * and the part this cannot reach are all on the predicate.
     *
     * `no-store` is load-bearing rather than tidy. The scheme is not in the
     * cache key, so a cacheable redirect stored under a shared key would be
     * handed to HTTPS readers as well and send them to the URL they already
     * asked for. Hard rule 8: an absent Cache-Control is CACHED, so this is
     * stated and not left to a default.
     *
     * IT IS IN THE GATEWAY, which is cache disabled, so the redirect could not
     * be stored even if the header were forgotten. The header stays anyway: it
     * is one string, and the property it asserts should not depend on which
     * entrypoint somebody later moves this to.
     */
    const secure = httpsRedirectTarget(request.url);
    if (secure !== null) {
      return new Response(null, {
        status: httpsRedirectStatus(request.method),
        headers: { Location: secure, "Cache-Control": "no-store" },
      });
    }

    const url = new URL(request.url);

    /*
     * RENAMED POSTS GO TO THEIR NEW URL, BEFORE ANY DATABASE READ.
     *
     * Ruling 47. Second in the gateway, and the position is the whole design:
     * after the HTTPS redirect, because a plaintext request must reach HTTPS
     * before anything else decides anything, and before the cache loopback,
     * because everything past this line either stores a response or renders
     * one. `blog.$slug.tsx` would answer these with a 404 out of its loader,
     * one D1 query after this line already knew the answer.
     *
     * Both representations, HTML and the `.md` twin, are handled by the
     * predicate. `no-store` for the reason the HTTPS redirect states: hard rule
     * 8 makes an absent Cache-Control a CACHED response, and the gateway is
     * cache disabled, so a stored redirect would be a surprise rather than a
     * saving.
     */
    const renamed = postRedirectTarget(url.pathname, redirects.posts);
    if (renamed !== null) {
      return new Response(null, {
        status: postRedirectStatus(request.method),
        headers: {
          // Resolved against this request's own origin, so the Location can
          // never name another host.
          Location: new URL(`${renamed}${url.search}`, url).toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    /*
     * THE PUBLICATION PDFs, WHICH ALL MOVED, AND THE PAPER PAGE'S TRAILING
     * SLASH. Third and fourth in the gateway, beside the post redirects and for
     * the same reasons: before the cache loopback, cache disabled, and resolved
     * against this request's own origin.
     *
     * ORDER MATTERS BETWEEN THESE TWO. The PDF map is consulted FIRST because
     * its keys end in `.pdf`, and `paperSlashTarget` refuses anything with a
     * dot in the final segment precisely so it can never claim an asset path.
     * Checking the map first means that refusal is a second line of defence
     * rather than the only one.
     *
     * Neither fires on a file that still exists: static assets are served by
     * the asset handler ahead of this Worker, so a request for a PDF at its
     * CURRENT path never reaches here.
     */
    const movedPdf = pdfRedirectTarget(url.pathname, redirects.pdfs);
    if (movedPdf !== null) {
      return new Response(null, {
        status: pdfRedirectStatus(request.method),
        headers: {
          Location: new URL(`${movedPdf}${url.search}`, url).toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    /*
     * `/publications/<slug>` to `/publications/<slug>/`.
     *
     * Both spellings match the route and both would render, which is two URLs
     * for one document. The slash form is canonical because it is the one that
     * puts the page in the same subdirectory as its PDF, which is Scholar's
     * stated condition for honouring `citation_pdf_url`.
     */
    const slashed = paperSlashTarget(url.pathname);
    if (slashed !== null) {
      return new Response(null, {
        status: pdfRedirectStatus(request.method),
        headers: {
          Location: new URL(`${slashed}${url.search}`, url).toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    /*
     * THE ONE THING READ OFF THE COOKIE, and it becomes the key's one dimension.
     * Grounds on `cacheDimensions`, including why the theme is in both the
     * custom key and the props.
     */
    const theme = themeFromRequest(request);
    const { cacheKey, props } = cacheDimensions(url, request, theme);

    /*
     * THE LOOPBACK. This is where the platform cache sits.
     *
     * `ctx.exports.Renderer` is a loopback service binding to the class above,
     * which Cloudflare documents as a cacheable invocation. On a hit the
     * Renderer does not run and this line returns a stored response; on a miss
     * it runs and its response is stored under the key given here.
     *
     * `enable_ctx_exports` has been default since compatibility date
     * 2025-11-17 and this Worker is on 2026-07-08, so no flag is needed. It was
     * MEASURED under `vite preview` before this was written, because a design
     * that only works in production is a design nobody can gate.
     */
    const response = await ctx.exports.Renderer({ props }).fetch(request, {
      cf: { cacheKey },
    });

    /*
     * THE COOKIE DOWNGRADE, kept as belt and braces (ruling 16) and moved here.
     *
     * It cannot live in the Renderer any more: that response is the one the
     * platform STORES, so writing `private, no-store` on it for a cookied
     * reader would mean cookied readers were never cached, which is the exact
     * regression this whole arc exists to end. Stamping it here changes only
     * the copy on the wire.
     *
     * WHAT IT IS FOR NOW, since the reason changed with the layer. There is no
     * shared cache in front of the gateway on workers.dev, so this is not
     * protecting the platform cache from itself; it is telling a BROWSER or an
     * intermediary proxy not to hold a document that genuinely differs per
     * reader. One header, and it fails in the safe direction.
     *
     * Keyed on the PRESENCE of any cookie and on the response having declared
     * the shared string. Presence rather than a theme cookie specifically is
     * the fail-closed reading, and it is the same reasoning the deleted
     * `cookieDowngrade` carried: a request holding only a session cookie must
     * not read as cookieless.
     *
     * Wrapped, because a response from the cache can have immutable headers and
     * a throw here would cost the reader their page for the sake of one header.
     */
    const shared = response.headers.get("cache-control") === SHARED_CACHE_CONTROL;
    let out = response;
    if (shared && request.headers.has("cookie")) {
      try {
        response.headers.set("cache-control", UNCACHED);
      } catch {
        const headers = new Headers(response.headers);
        headers.set("cache-control", UNCACHED);
        out = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    /*
     * THE TRAFFIC ROW, from the gateway, which is the whole of ruling 12.
     *
     * It reads the FINISHED response's status and content type, so it counts
     * what the reader actually got, and it runs whether that came from the
     * cache or from a render. Every refusal it carries is unchanged: HTML only,
     * 200 only, never the admin plane, referer reduced to a host, path
     * redacted. Grounds on the function.
     */
    recordTraffic(request, out, env, url);

    return out;
  },

  /**
   * R2 event notifications from `dustinedwards-media`, deriving the D1 index.
   *
   * Separate from `fetch` on purpose: no HTTP request ever triggers this, and no
   * reader ever waits on it. The grounds and the idempotency argument are in
   * `media-events.ts`.
   *
   * ON THE GATEWAY rather than the Renderer, and the docs make that the only
   * option: queue invocations bypass the cache entirely, so an entrypoint that
   * exists to be cached is the wrong home for one.
   */
  async queue(batch, env) {
    await handleMediaEvents(batch, env);
  },

} satisfies ExportedHandler<Env>;