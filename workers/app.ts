// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";

import { analyticsPath } from "~/lib/analytics-path.mjs";
import { cloudflareContext, nonceContext } from "~/lib/context";
import { httpsRedirectStatus, httpsRedirectTarget } from "~/lib/https-redirect.mjs";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { EDGE_CACHE_CONTROL, EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL } from "~/lib/seo";
import { postRedirectTarget } from "~/lib/slug-redirect.mjs";
import {
  paperSlashTarget,
  pdfRedirectTarget,
} from "~/lib/publications/pdf-redirect.mjs";
// Imported here, not in the predicate's .mjs, because Node ESM refuses a bare JSON import.
import redirects from "../content/redirects.json";
import { themeFromRequest } from "~/lib/theme";
import { serverTiming, timingsContext, type Timings } from "~/lib/timing";
import {
  CSP_ENDPOINT_NAME,
  CSP_REPORT_PATH,
  contentSecurityPolicy,
  isAdminPath,
} from "./csp.mjs";
import { isUnpolicedType } from "./feed-types.mjs";
import { handleMediaEvents } from "./media-events";
import { errorMessage } from "~/lib/error-message.mjs";
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
    !isAdminPath(url.pathname) &&
    !negotiatesAwayFromHtml(request);

  if (!themed) return { cacheKey: `${url.pathname}${url.search}`, props: {} };

  const keyUrl = new URL(url);
  keyUrl.searchParams.set("theme", theme);
  return { cacheKey: `${keyUrl.pathname}${keyUrl.search}`, props: { theme } };
}

/**
 * Looks tightenable and is not: CORP `same-origin` would break off-site og:image previews; COOP is
 * left loose for the auth client's popups; no `includeSubDomains` or `preload`, since the parent
 * domain is not ours. Never deny `clipboard-write`: the copy controls swallow the refusal silently.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  // One string literal, never a concatenation: two gates parse this object with a regex.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
};


function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

// No client identifier: no cookie, IP, user agent or anything derived from them. Wrapped, because
// "returns immediately" is not "never throws".
function recordTraffic(request: Request, response: Response, env: Env, url: URL) {
  try {
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return;
    if (response.status !== 200) return;
    if (isAdminPath(url.pathname)) return;

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

    // Redacted before the write, a security control: `/preview/<token>` carries a capability.
    const path = analyticsPath(url.pathname);

    env.ANALYTICS.writeDataPoint({
      blobs: [path, refererHost, (request.cf?.country as string) ?? "", device],
      doubles: [1],
      // The index is the sampling key; the redacted path keeps per-path counts meaningful.
      indexes: [path],
    });
  } catch (error) {
    /* Analytics must never cost a reader their page, but a broken write is logged, or the traffic
     * view reads a failing binding as a quiet day. */
    console.error(
      JSON.stringify({
        alert: "traffic-write-failed",
        detail: errorMessage(error),
      }),
    );
  }
}

/**
 * Every header a rendered response leaves with, on both exits of the Renderer: timing, the security
 * set, the report endpoint, the policy (feeds excepted) and the uncached default.
 */
function applyDocumentHeaders(
  headers: Headers,
  { timings, reportTo, csp }: { timings: Timings | undefined; reportTo: string; csp: string },
) {
  if (timings) headers.set("Server-Timing", serverTiming(timings));
  applySecurityHeaders(headers);
  headers.set("Reporting-Endpoints", reportTo);
  if (!isUnpolicedType(headers.get("content-type"))) {
    headers.set("Content-Security-Policy", csp);
  }
  if (!headers.has("cache-control")) headers.set("cache-control", UNCACHED);
  applyEdgePolicy(headers);
}

/**
 * The cacheable entrypoint; `default` has cache disabled. It must not write the traffic row, which
 * would then count only misses. Document headers belong here, or they are absent from every hit.
 */
export class Renderer extends WorkerEntrypoint<Env, RendererProps> {
  override async fetch(request: Request): Promise<Response> {
    const env = this.env;
    const ctx = this.ctx;
    const url = new URL(request.url);

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });

    // Admin only: a public page is edge-cached with its header, so a nonce there would be shared
    // by every reader; its one inline script is allowed by hash instead (workers/csp.mjs). A static
    // or derived nonce looks exactly like success: every page renders and the policy is worth
    // nothing.
    const adminNonce = isAdminPath(url.pathname) ? crypto.randomUUID() : undefined;
    context.set(nonceContext, adminNonce);

    // Stamped here because loaders run concurrently on one shared `timings` array; only after the
    // handler returns is it complete.
    const handlerStart = performance.now();
    const response = await requestHandler(request, context);
    const timings = context.get(timingsContext).timings;
    if (timings) {
      timings.push({ name: "worker_total", ms: performance.now() - handlerStart });
    }

    // Absolute, because `Reporting-Endpoints` ignores a non-secure or relative endpoint.
    const reportTo = `${CSP_ENDPOINT_NAME}="${url.origin}${CSP_REPORT_PATH}"`;
    const csp = await contentSecurityPolicy(adminNonce);


    const document = { timings, reportTo, csp };

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
 * Order is load-bearing: the HTTPS redirect first, because the cache key ignores the scheme; the
 * traffic row last, so hits are counted too.
 */
export default {
  async fetch(request, env, ctx) {
    const response = await gateway(request, env, ctx);
    // Every exit, redirects included, which never pass through applyDocumentHeaders. Static assets
    // are served before the Worker runs, so robots.txt's Disallow is what covers those.
    return isWorkerPreview(env) ? withHeader(response, "X-Robots-Tag", "noindex") : response;
  },

  async queue(batch, env) {
    await handleMediaEvents(batch, env);
  },

} satisfies ExportedHandler<Env>;

async function gateway(...[request, env, ctx]: FetchArgs): Promise<Response> {
  const secure = httpsRedirectTarget(request.url);
  if (secure !== null) return redirectTo(request, secure);

  const url = new URL(request.url);

  const renamed = postRedirectTarget(url.pathname, redirects.posts);
  if (renamed !== null) return redirectTo(request, new URL(`${renamed}${url.search}`, url).toString());

  // The PDF map runs before the slash redirect because its keys end in `.pdf`.
  const movedPdf = pdfRedirectTarget(url.pathname, redirects.pdfs);
  if (movedPdf !== null) {
    return redirectTo(request, new URL(`${movedPdf}${url.search}`, url).toString());
  }

  // The slash form is canonical: Scholar honors `citation_pdf_url` only in the page's subdirectory.
  const slashed = paperSlashTarget(url.pathname);
  if (slashed !== null) {
    return redirectTo(request, new URL(`${slashed}${url.search}`, url).toString());
  }

  const theme = themeFromRequest(request);
  const { cacheKey, props } = cacheDimensions(url, request, theme);

  const response = await ctx.exports.Renderer({ props }).fetch(request, {
    cf: { cacheKey },
  });

  // Tells browsers and proxies not to hold a per-reader document. Not in the Renderer, whose
  // response is the one the platform stores. Any cookie counts, failing closed.
  const shared = response.headers.get("cache-control") === SHARED_CACHE_CONTROL;
  const out =
    shared && request.headers.has("cookie") ? withHeader(response, "cache-control", UNCACHED) : response;

  recordTraffic(request, out, env, url);

  return out;
}