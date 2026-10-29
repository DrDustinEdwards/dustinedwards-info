// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext, documentHandlerContext, nonceContext } from "~/lib/context";
import { httpsRedirectStatus, httpsRedirectTarget } from "~/lib/https-redirect.mjs";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { EDGE_CACHE_CONTROL, EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL } from "~/lib/seo";
import { isApexHost, wordpressDisposition, wwwRedirectTarget } from "~/lib/wordpress-redirects.mjs";
import { paperSlashTarget } from "~/lib/publications/pdf-redirect.mjs";
import { themeFromRequest } from "~/lib/theme";
import { serverTiming, timingsContext, type Timings } from "~/lib/timing";
import {
  CSP_ENDPOINT_NAME,
  CSP_REPORT_PATH,
  contentSecurityPolicy,
  isPrivatePath,
} from "./csp.mjs";
import { isUnpolicedType } from "./feed-types.mjs";
import { applyHeaderSet } from "@dustinedwards/site-runtime/headers";
import { reportingEndpoints } from "@dustinedwards/site-runtime/csp";
import {
  SPECULATION_RULES_HEADER,
  SPECULATION_RULES_PATH,
  speculationRulesResponse,
} from "@dustinedwards/site-runtime/prefetch";
import { SECURITY_HEADERS } from "./security-headers.mjs";
import { handleMediaEvents } from "./media-events";
import { handleWebmentionVerify } from "./webmention-verify";
import { WEBMENTION_VERIFY_QUEUE } from "~/lib/webmention/queue";
import { isWorkerPreview } from "~/lib/worker-preview";

export { AskBudget } from "./ask-budget";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// Omitting Cache-Control is not opting out: the platform caches it heuristically and cookies are not
// in the key, so an authenticated /admin render would be served to anyone.
const UNCACHED = "private, no-store";

// `Cloudflare-CDN-Cache-Control` outranks `Cache-Control` at the edge, so it is stripped from any
// response not marked shared, or a private one would become storable.
function applyEdgePolicy(headers: Headers): void {
  if (headers.get("cache-control") !== SHARED_CACHE_CONTROL) {
    headers.delete(EDGE_CACHE_HEADER);
    return;
  }
  if (!headers.has(EDGE_CACHE_HEADER)) headers.set(EDGE_CACHE_HEADER, EDGE_CACHE_CONTROL);
}

// The path is written into the key because a custom `cf.cacheKey` replaces the platform's path and
// query rather than extending them. The platform cache is the only cache; do not add `caches.default`.
export type RendererProps = { theme?: string };

export function cacheDimensions(
  url: URL,
  request: Request,
  theme: string,
): { cacheKey: string; props: RendererProps } {
  const themed =
    request.method === "GET" &&
    !isPrivatePath(url.pathname) &&
    !negotiatesAwayFromHtml(request);

  if (!themed) return { cacheKey: `${url.pathname}${url.search}`, props: {} };

  const keyUrl = new URL(url);
  keyUrl.searchParams.set("theme", theme);
  return { cacheKey: `${keyUrl.pathname}${keyUrl.search}`, props: { theme } };
}

// The shared package's apply, authoritative: this site's set wins over anything a route set.
function applySecurityHeaders(headers: Headers) {
  applyHeaderSet(headers, SECURITY_HEADERS);
}

/**
 * Hover prefetch (site-runtime ./prefetch): the rules beyond the package's own exclusions. /lab is signed in,
 * /media is files, /login and /theme act on a request, and `/search/ask` is billed: prefetching it would spend
 * model tokens on a click nobody made. File links (.md, .xml, .json, .txt) and links with a query are the
 * package's defaults.
 */
const PREFETCH_EXCLUDE = ["/lab", "/media", "/login", "/theme", "/search/ask"];

/**
 * Every header a rendered response leaves with, on both exits of the Renderer: timing, the security
 * set, the report endpoint, the policy (feeds excepted), the prefetch rules on a public page and the
 * uncached default.
 */
function applyDocumentHeaders(
  headers: Headers,
  { timings, reportTo, csp, publicPage }: { timings: Timings | undefined; reportTo: string; csp: string; publicPage: boolean },
) {
  if (timings) headers.set("Server-Timing", serverTiming(timings));
  applySecurityHeaders(headers);
  headers.set("Reporting-Endpoints", reportTo);
  if (!isUnpolicedType(headers.get("content-type"))) {
    headers.set("Content-Security-Policy", csp);
  }
  // Public HTML only: the signed-in planes never prefetch.
  if (publicPage && (headers.get("content-type") ?? "").startsWith("text/html")) {
    headers.set(SPECULATION_RULES_HEADER.name, SPECULATION_RULES_HEADER.value);
  }
  if (!headers.has("cache-control")) headers.set("cache-control", UNCACHED);
  applyEdgePolicy(headers);
}

/**
 * The cacheable entrypoint; `default` has cache disabled. Document headers belong here, or they are absent from every hit.
 */
export class Renderer extends WorkerEntrypoint<Env, RendererProps> {
  override async fetch(request: Request): Promise<Response> {
    const env = this.env;
    const ctx = this.ctx;
    const url = new URL(request.url);

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    // For the Carrel preview, which renders a page through the same routes without a second fetch.
    context.set(documentHandlerContext, requestHandler);

    // The private planes only (/admin, /lab): a public page is edge-cached with its header, so a nonce there would be shared
    // by every reader; it runs no inline script, only same-origin files (workers/csp.mjs). A static
    // or derived nonce looks exactly like success: every page renders and the policy is worth
    // nothing.
    const adminNonce = isPrivatePath(url.pathname) ? crypto.randomUUID() : undefined;
    context.set(nonceContext, adminNonce);

    // Stamped here because loaders run concurrently on one shared `timings` array; only after the
    // handler returns is it complete.
    const handlerStart = performance.now();
    const response = await requestHandler(request, context);
    const timings = context.get(timingsContext).timings;
    if (timings) {
      timings.push({ name: "worker_total", ms: performance.now() - handlerStart });
    }

    // Absolute https (the gateway has already redirected plaintext): `Reporting-Endpoints` ignores anything else.
    const reportTo = reportingEndpoints(CSP_ENDPOINT_NAME, new URL(CSP_REPORT_PATH, url.origin));
    const csp = contentSecurityPolicy(url.pathname, adminNonce);
    const document = { timings, reportTo, csp, publicPage: !isPrivatePath(url.pathname) };

    // `Response.redirect()` and friends return immutable headers, so a `set` throws; the catch
    // rebuilds and applies the same set.
    try {
      applyDocumentHeaders(response.headers, document);
    } catch {
      const headers = new Headers(response.headers);
      applyDocumentHeaders(headers, document);
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
 * A gateway redirect: 301 for GET and HEAD, 308 otherwise so a form body survives. `no-store` is
 * load-bearing: the scheme is not in the cache key, so a stored HTTPS redirect would loop HTTPS
 * readers, and a stored rename would outlive a change to the map.
 */
function redirectTo(request: Request, location: string) {
  return new Response(null, {
    status: httpsRedirectStatus(request.method),
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

/** A fetched response's headers can be immutable, so a refused set rebuilds it around a copy. */
function withHeader(response: Response, name: string, value: string): Response {
  try {
    response.headers.set(name, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

type FetchArgs = Parameters<NonNullable<ExportedHandler<Env>["fetch"]>>;

/*
 * THE GATEWAY. Cache disabled, so it runs on every request (check:urls reads this phrase).
 * Order is load-bearing: the HTTPS redirect first, because the cache key ignores the scheme.
 */
export default {
  async fetch(request, env, ctx) {
    const response = await gateway(request, env, ctx);
    // Every exit, redirects included, which never pass through applyDocumentHeaders. Static assets
    // are served before the Worker runs, so robots.txt's Disallow is what covers those.
    // The workers.dev address keeps answering after the cutover (the watchdog, the browser tests and
    // the sign-in fallback use it), so it is kept out of the index here rather than redirected away.
    // robots.txt must not disallow it, or a crawler never reads this header.
    const unindexed = isWorkerPreview(env) || new URL(request.url).hostname.endsWith(".workers.dev");
    return unindexed ? withHeader(response, "X-Robots-Tag", "noindex") : response;
  },

  async queue(batch, env) {
    if (batch.queue === WEBMENTION_VERIFY_QUEUE) await handleWebmentionVerify(batch, env);
    else await handleMediaEvents(batch, env);
  },

  // The one cron (wrangler.jsonc.example): every scheduled update that is due goes live, and IndexNow is told.
  // A failed one throws after the pass, so the invocation is recorded as failed; the next firing retries it.
  // Imported here, not at the top: the gateway never loads the save path, and neither does the test entry.
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const { runCarrelSchedules } = await import("~/lib/carrel/site-api.server");
        const run = await runCarrelSchedules(env, ctx, new Date(controller.scheduledTime));
        console.log(JSON.stringify({ schedules: run }));
        if (run.failed > 0) throw new Error(`${run.failed} scheduled update(s) failed; the next firing retries them`);
      })(),
    );
  },

} satisfies ExportedHandler<Env>;

async function gateway(...[request, , ctx]: FetchArgs): Promise<Response> {
  // First, so `http://www/x` is one hop to `https://apex/x` and not two.
  const requested = new URL(request.url);
  const apex = wwwRedirectTarget(requested.hostname, requested.pathname, requested.search);
  if (apex !== null) return redirectTo(request, apex);

  const secure = httpsRedirectTarget(request.url);
  if (secure !== null) return redirectTo(request, secure);

  const url = new URL(request.url);

  // The prefetch rules every public page's header names: one file, the same for every page, so no route renders it.
  if (url.pathname === SPECULATION_RULES_PATH) {
    const rules = speculationRulesResponse({ exclude: PREFETCH_EXCLUDE });
    applySecurityHeaders(rules.headers);
    return rules;
  }

  // The old WordPress addresses, on the apex host only: the new site's own paths never reach this map.
  const wordpress = isApexHost(url.hostname) ? wordpressDisposition(url.pathname) : null;
  if (wordpress?.status === 301) {
    return redirectTo(request, new URL(wordpress.location, url).toString());
  }

  // The slash form is canonical: Scholar honors `citation_pdf_url` only in the page's subdirectory.
  const slashed = paperSlashTarget(url.pathname);
  if (slashed !== null) return redirectTo(request, new URL(`${slashed}${url.search}`, url).toString());

  // A removed WordPress address renders the Gone page in its place: the address bar keeps the old URL
  // and the status is 410. Every redirect above was decided first; none of them names a removed path.
  const gone = wordpress?.status === 410 ? new URL("/gone", url) : null;

  const theme = themeFromRequest(request);
  const { cacheKey, props } = cacheDimensions(gone ?? url, request, theme);

  const response = await ctx.exports.Renderer({ props }).fetch(gone ? new Request(gone, request) : request, {
    cf: { cacheKey },
  });

  // Tells browsers and proxies not to hold a per-reader document. Not in the Renderer, whose
  // response is the one the platform stores. Any cookie counts, failing closed.
  const shared = response.headers.get("cache-control") === SHARED_CACHE_CONTROL;
  const out =
    shared && request.headers.has("cookie") ? withHeader(response, "cache-control", UNCACHED) : response;

  return out;
}