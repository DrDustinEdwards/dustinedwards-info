// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";

import { analyticsPath } from "~/lib/analytics-path.mjs";
import { cloudflareContext, nonceContext } from "~/lib/context";
import { httpsRedirectStatus, httpsRedirectTarget } from "~/lib/https-redirect.mjs";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { EDGE_CACHE_CONTROL, EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL } from "~/lib/seo";
import { postRedirectStatus, postRedirectTarget } from "~/lib/slug-redirect.mjs";
import {
  paperSlashTarget,
  pdfRedirectStatus,
  pdfRedirectTarget,
} from "~/lib/publications/pdf-redirect.mjs";
/*
 * The redirect map, imported here rather than inside the predicate: a bare JSON import is what
 * compiles in this repo and what Node ESM refuses, so the `.mjs` module `node --test` loads cannot
 * do it and this one can.
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

// Re-exported so the runtime can find the class its binding names. The Ask spend ceiling is a
// Durable Object rather than KV because it has to be exact.
export { AskBudget } from "./ask-budget";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

/**
 * What a response gets when it never said what it wanted.
 *
 * OMITTING Cache-Control IS NOT OPTING OUT: the platform stores such a response under heuristic
 * freshness and COOKIES ARE NOT IN THE KEY, so without this an authenticated /admin render would be
 * served to anyone asking for that path. The default is the refusal and a route opts IN.
 */
const UNCACHED = "private, no-store";

/**
 * THE EDGE'S POLICY, stamped here so every shared response carries it, including the feeds and the
 * sitemap, which set `SHARED_CACHE_CONTROL` by hand rather than through `publicHtmlHeaders`.
 *
 * FAIL CLOSED IN THE OTHER DIRECTION TOO: `Cloudflare-CDN-Cache-Control` OUTRANKS `Cache-Control` at
 * the edge, so an edge header on a response that is NOT marked shared would make a private one
 * storable. It is removed from anything not marked shared, whatever set it.
 */
function applyEdgePolicy(headers: Headers): void {
  if (headers.get("cache-control") !== SHARED_CACHE_CONTROL) {
    headers.delete(EDGE_CACHE_HEADER);
    return;
  }
  if (!headers.has(EDGE_CACHE_HEADER)) headers.set(EDGE_CACHE_HEADER, EDGE_CACHE_CONTROL);
}

/**
 * WHAT THE CACHE KEY IS: the path, and the theme, which is the only thing read off the cookie and
 * rides in both the props and the custom key.
 *
 * THE PATH IS WRITTEN IN because a custom `cf.cacheKey` REPLACES the platform's path and query
 * rather than extending them, and is honored only for same-account loopback calls: a key of
 * `theme=dark` alone would collapse every page onto one entry.
 *
 * **THE PLATFORM CACHE IS THE ONLY CACHE.** `caches.default` is used nowhere here, and if you are
 * about to add a second one, the first was deleted on purpose.
 *
 * What licenses a key this short is `check:browser`, which proves a credentialed reader gets
 * byte-identical HTML and that the theme moves only `data-theme` and the meta.
 */
export type RendererProps = { theme?: string };

/**
 * The cache key and the props for one request. PURE, so it can be tested.
 *
 * THE THEME DIMENSION IS ADDED ONLY WHERE A DOCUMENT COULD CARRY IT: a GET, not an admin path, not
 * a request negotiating away from HTML. Admin responses are `private, no-store` by their own
 * declaration, so it is belt and braces there; the negotiated case is not, and the grounds are on
 * `negotiatesAwayFromHtml`.
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
 * Security headers, on EVERY response: one constant applied on the way out, so a route added later
 * is covered without anyone remembering.
 *
 * Four look tightenable and are not:
 *
 * - **`Cross-Origin-Resource-Policy: cross-origin`, NOT `same-origin`**, which would stop social
 *   platforms fetching `og:image` and break link previews off-site, where nothing here sees it.
 * - **`Cross-Origin-Opener-Policy: same-origin-allow-popups`. Do not tighten.** The notch is
 *   insurance against dependency drift in the auth client, on the one door into the private plane.
 * - **No `includeSubDomains`, no `preload`**: the parent domain is not ours to assert a policy for.
 * - **`X-Frame-Options: DENY` is a legacy mirror of `frame-ancestors`.** Delete it only once the
 *   CSP is enforcing, or the site spends that window framable.
 *
 * **THE SITE USES `clipboard-write` AND IT MUST NEVER BE DENIED HERE.** It is on the PUBLIC plane,
 * behind the copy-code, permalink and copy-markdown controls, and the enhancement swallows a
 * refusing clipboard, so denying it breaks them SILENTLY.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  // ONE STRING LITERAL, never a concatenation: two gates parse this object with a
  // `"name": "value"` regex, so a `+`-joined value would parse as its FIRST fragment only and the
  // gate would compare half a header.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
};


/** @param headers the response headers to stamp, mutable or a fresh copy */
function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

/**
 * The Phase B policy, and it BLOCKS: `Content-Security-Policy`, not `-Report-Only`.
 *
 * **THE SHARED-CACHE NONCE EXPOSURE IS LIVE AND ACCEPTED**: header and body are cached together, so
 * one nonce is valid for the cache lifetime. Accepted publicly on /colophon rather than in a
 * comment, a showcase listing only its wins being an advertisement.
 *
 * `style-src-attr 'unsafe-inline'` is deliberate and must not be "fixed"; the measurement is on the
 * directive in `./csp.mjs`, the only copy. **THE ROUTE LIST IS NOT REPEATED HERE**, the cache-header rule's
 * habit: `check:headers` owns it both ways, and the paragraph that restated it was wrong three
 * times, once calling a route `private, no-store` when it fell through to the cache-header rule's default.
 *
 * THE BUILDER IS IN `./csp.mjs` AS A GATE REQUIREMENT: source text can see two branches exist but
 * not which one a request gets, and a module can be imported and called.
 */

/**
 * One traffic row per HTML response, into Analytics Engine.
 *
 * NO CLIENT IDENTIFIER, structurally rather than as a promise: no cookie, no IP, no user agent,
 * nothing derived from them. THAT CLAIM WAS FALSE FOR ONE ROUTE, a preview URL carrying a
 * capability in its PATH, so it is written down as a claim that already aged once.
 *
 * THIS CANNOT FAIL A RESPONSE: never awaited, and wrapped anyway, because "returns immediately" is
 * not "never throws". The catch is silent so a failed write is neither an error page nor log noise.
 *
 * @param request  the incoming request
 * @param response the finished response, read for status and content type
 * @param env      the Worker environment carrying the ANALYTICS binding
 * @param url      already parsed by the caller, so this parses nothing twice
 */
function recordTraffic(request: Request, response: Response, env: Env, url: URL) {
  try {
    // HTML only. The assets, feeds, twins, /media and the API routes are traffic and not page views.
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return;
    // Errors and redirects are not reads.
    if (response.status !== 200) return;
    // THE OPERATOR IS NOT AN AUDIENCE, skipped at write time rather than left for a query to filter:
    // a panel that counts its own author is worse than no panel.
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
     * THE PATH IS REDACTED BEFORE THE WRITE, a security control rather than a data choice:
     * `/preview/<token>` puts a CAPABILITY in the URL, and writing it verbatim stored and displayed it.
     *
     * **AE ROWS ARE IMMUTABLE**, so earlier rows age out rather than being fixed. Bounded on two sides
     * and accepted on that basis: a token expires whatever the dataset remembers, and reading the
     * dataset needs a Worker secret.
     */
    const path = analyticsPath(url.pathname);

    env.ANALYTICS.writeDataPoint({
      blobs: [path, refererHost, (request.cf?.country as string) ?? "", device],
      doubles: [1],
      // Indexes are the SAMPLING KEY, and path is the right one: it keeps the per-path counts this
      // exists to produce meaningful under sampling. The REDACTED path necessarily, a distinct index per
      // token also being the worst possible shape for a sampling key.
      indexes: [path],
    });
  } catch {
    /* Analytics must never cost a reader their page. */
  }
}

/**
 * THE RENDERER: everything that produces a document, and the entrypoint the platform may cache.
 *
 * Cache is per entrypoint and this Worker's two jobs want opposite answers, so `default` is cache
 * DISABLED and runs always while this is ENABLED and runs on a miss; the real config and the
 * example must both say so.
 *
 * IT MUST NOT WRITE THE TRAFFIC ROW: on a hit this does not run, so a count here would become a
 * count of MISSES, looking like readership while moving with cache behavior.
 *
 * It owns what belongs to the DOCUMENT, the nonce, render, timing and security headers, the CSP and
 * the cache-header rule's uncached default, because a header stamped after the cache is absent from every hit.
 */
export class Renderer extends WorkerEntrypoint<Env, RendererProps> {
  override async fetch(request: Request): Promise<Response> {
    const env = this.env;
    const ctx = this.ctx;
    /* Parsed once: the CSP's `Reporting-Endpoints` and the admin branch of the policy both read it. */
    const url = new URL(request.url);

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });

    /*
     * THE NONCE, GENERATED BEFORE THE RENDER, which is the deviation: everything else here is stamped
     * onto a finished response, and a nonce cannot be, because the identical value has to reach the
     * header AND every `<script>` in the body. Grounds on `nonceContext`.
     *
     * **A STATIC OR DERIVED NONCE IS THE FAILURE MODE THAT LOOKS EXACTLY LIKE SUCCESS:** every page
     * renders, nothing reports, and the policy is worth nothing. verify-live asserts two responses
     * differ, which is the only place that can be seen.
     */
    const nonce = crypto.randomUUID();
    context.set(nonceContext, nonce);

    /*
     * THE TIMING HEADER IS STAMPED HERE BECAUSE EVERY OTHER PLACE RACES: `timings` is ONE shared array
     * and a matched route's loaders run CONCURRENTLY, so a loader stamping it stamped whatever had
     * accumulated when IT finished. Here the handler has returned, so the array is complete.
     *
     * Creating the array stays in the admin middleware, which confines timing to that subtree: a
     * request that never asked carries `undefined` and this block is skipped.
     */
    const handlerStart = performance.now();
    const response = await requestHandler(request, context);
    const timings = context.get(timingsContext).timings;
    /*
     * `worker_total` BOUNDS EVERYTHING and is the only mark this file adds. It is not an instrument
     * for the response path, which does not own real time; it is an outer bound, so the residual can be
     * read off the header rather than reconstructed from a browser.
     */
    if (timings) {
      timings.push({ name: "worker_total", ms: performance.now() - handlerStart });
    }

    /*
     * ALL response-level policy in ONE place with ONE immutable fallback. `Response.redirect()` and
     * friends return immutable headers, so a `set` throws and rebuilding is the only way to stamp
     * them; rebuilding stays on the catch branch because routing every response through a new one is
     * pointless work on the routes that stream.
     *
     * The property is that the security headers reach EVERY response, including one whose headers
     * refuse a `set`, so both branches apply the same set.
     */

    // Absolute, because `Reporting-Endpoints` takes a URL and a non-secure endpoint is ignored.
    // Derived from the request, so it is right on workers.dev today and on the apex after cutover with
    // nothing to add to the cutover list.
    const reportTo = `${CSP_ENDPOINT_NAME}="${url.origin}${CSP_REPORT_PATH}"`;
    /*
     * The style nonce is emitted for the ADMIN PLANE ONLY, keyed on the path. `isAdminPath` owns the
     * exact-or-slash test and what an unauthenticated request to an admin path gets.
     */
    const csp = contentSecurityPolicy(nonce, isAdminPath(url.pathname));


    /*
     * The three conditions a hand-written store block used to check are the platform's own answers
     * now: the response says whether it is storable, the cache takes GET and HEAD only, and a
     * `Set-Cookie` response is an automatic bypass. What survives as this file's rule is the cache-header rule's
     * default below, which is what makes a route that says nothing refuse.
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
      applyEdgePolicy(response.headers);
    } catch {
      const headers = new Headers(response.headers);
      if (timings) headers.set("Server-Timing", serverTiming(timings));
      applySecurityHeaders(headers);
      headers.set("Reporting-Endpoints", reportTo);
      if (!isFeed(headers.get("content-type"))) {
        headers.set("Content-Security-Policy", csp);
      }
      if (!headers.has("cache-control")) headers.set("cache-control", UNCACHED);
      applyEdgePolicy(headers);
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
 * THE GATEWAY. Cache disabled, so it runs on every request, doing only the four things that must
 * not be skipped and handing the rest to the `Renderer` through a loopback the platform may answer
 * from cache.
 *
 *   1. the HTTPS redirect, before anything is parsed
 *   2. the theme cookie read, which becomes the cache key's one dimension
 *   3. the loopback, with that key and those props
 *   4. the traffic row, AFTER the response comes back, hit or miss
 *
 * THE ORDER IS LOAD BEARING: the redirect is first because a plaintext request must never reach a
 * lookup keyed on a path that ignores the scheme, and the row is last so it is written from the
 * finished thing. What a hit skips is the RENDERER, not this Worker, which is what lets the count
 * see every page view.
 */
export default {
  async fetch(request, env, ctx) {
    /*
     * PLAINTEXT GOES TO HTTPS BEFORE ANYTHING ELSE HAPPENS; the grounds are on the predicate.
     *
     * `no-store` is load-bearing: the scheme is NOT in the cache key, so a stored redirect would be
     * handed to HTTPS readers and send them where they already asked. The cache-header rule makes an absent
     * Cache-Control a CACHED response. It stays even though the gateway is cache disabled, because the
     * property should not depend on which entrypoint somebody moves this to.
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
     * The position is the design: after the HTTPS redirect, and before the cache loopback, because
     * everything past that line either stores a response or renders one. Both representations are
     * handled by the predicate. `no-store` for the reason the redirect above states, the cache-header rule
     * making an absent Cache-Control a CACHED response.
     */
    const renamed = postRedirectTarget(url.pathname, redirects.posts);
    if (renamed !== null) {
      return new Response(null, {
        status: postRedirectStatus(request.method),
        headers: {
          // Resolved against this request's own origin, so the Location can never name another host.
          Location: new URL(`${renamed}${url.search}`, url).toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    /*
     * THE PUBLICATION PDFs AND THE PAPER PAGE'S TRAILING SLASH, beside the post redirects and for the
     * same reasons.
     *
     * ORDER MATTERS BETWEEN THESE TWO: the PDF map is consulted FIRST because its keys end in `.pdf`,
     * and `paperSlashTarget` refuses anything with a dot in the final segment precisely so it can never
     * claim an asset path, which makes that refusal a second line of defense rather than the only one.
     *
     * Neither fires on a file that still exists: the asset handler serves those ahead of this Worker.
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
     * `/publications/<slug>` to its trailing-slash form. Both spellings render, which is two URLs for
     * one document, and the slash form is canonical because it puts the page in the same subdirectory
     * as its PDF, which is Scholar's stated condition for honoring `citation_pdf_url`.
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
     * Grounds on `cacheDimensions`.
     */
    const theme = themeFromRequest(request);
    const { cacheKey, props } = cacheDimensions(url, request, theme);

    /*
     * THE LOOPBACK, and where the platform cache sits. `ctx.exports.Renderer` is a loopback service
     * binding to the class above, which is a cacheable invocation: on a hit the Renderer does not run
     * and this returns a stored response, on a miss it runs and its response is stored under this key.
     */
    const response = await ctx.exports.Renderer({ props }).fetch(request, {
      cf: { cacheKey },
    });

    /*
     * THE COOKIE DOWNGRADE, kept as belt and braces, and it cannot live in the Renderer: that response
     * is the one the platform STORES, so writing `private, no-store` there for a cookied reader would
     * mean cookied readers were never cached.
     *
     * WHAT IT IS FOR NOW: there is no shared cache in front of the gateway on workers.dev, so this is
     * not protecting the platform cache from itself. It tells a BROWSER or an intermediary proxy not to
     * hold a document that genuinely differs per reader.
     *
     * Keyed on the PRESENCE of any cookie, the fail-closed reading, since a request holding only a
     * session cookie must not read as cookieless. Wrapped, because a cached response can have immutable
     * headers and a throw would cost the reader their page for one header.
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
     * THE TRAFFIC ROW, from the gateway, so it reads the FINISHED response and runs whether that came
     * from the cache or from a render. Every refusal it carries is unchanged and on the function.
     */
    recordTraffic(request, out, env, url);

    return out;
  },

  /**
   * R2 event notifications, deriving the D1 index. Separate from `fetch` on purpose: no HTTP request
   * triggers it and no reader waits on it, and the grounds are in `media-events.ts`. ON THE GATEWAY
   * because queue invocations bypass the cache entirely, so an entrypoint that exists to be cached is
   * the wrong home for one.
   */
  async queue(batch, env) {
    await handleMediaEvents(batch, env);
  },

} satisfies ExportedHandler<Env>;