// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext, documentHandlerContext, nonceContext } from "~/lib/context";
import { httpsRedirectStatus } from "~/lib/https-redirect.mjs";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { cacheTags, EDGE_CACHE_CONTROL, EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL } from "~/lib/seo";
import { THEME_COOKIE } from "capsomer/theme-server";
import { isApexHost, wordpressDisposition, wwwRedirectTarget } from "~/lib/wordpress-redirects.mjs";
import { PUBLICATIONS_PREFIX, paperSlashTarget } from "~/lib/publications/pdf-redirect.mjs";
import { themeFromRequest } from "~/lib/theme";
import { timingsContext } from "~/lib/timing";
import {
  CSP_ENDPOINT_NAME,
  CSP_REPORT_PATH,
  contentSecurityPolicy,
  isPrivatePath,
} from "./csp.mjs";
import { isUnpolicedType } from "./feed-types.mjs";
import { withAdminIdle } from "@dustinedwards/site-runtime/access";
import { applyHeaderSet, corpFor } from "@dustinedwards/site-runtime/headers";
import { cacheKey, forReader, forRenderer, settleCacheHeaders, withPurgePages } from "@dustinedwards/site-runtime/edge-cache";
import { withPreloadHeader } from "@dustinedwards/site-runtime/preload";
import { timedRender } from "@dustinedwards/site-runtime/server-timing";
import { canonicalRedirect } from "@dustinedwards/site-runtime/url";
import { generateNonce, reportingEndpoints } from "@dustinedwards/site-runtime/csp";
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
import { PRELOADS } from "~/lib/preloads";
import { runJobs } from "@dustinedwards/site-runtime/cron";
import { withRequestLog } from "@dustinedwards/site-runtime/log";
import { cronJob } from "~/lib/cron-jobs.mjs";
import { recordPurge } from "~/lib/purge-record.server";

export { AskBudget } from "./ask-budget";

/** The one firing a day that takes the nightly D1 dump: 05:00 UTC. */
function isNightly(at: Date): boolean {
  return at.getUTCHours() === 5 && at.getUTCMinutes() === 0;
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// site-runtime's `cacheKey`: the path and the query without tracking parameters, plus the theme an HTML read is
// rendered in. The platform cache is the only cache; do not add `caches.default`.
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

  if (!themed) return { cacheKey: cacheKey(url), props: {} };
  return { cacheKey: cacheKey(url, { dimensions: { theme } }), props: { theme } };
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
 * Every header a rendered response leaves with: the security set, the report endpoint, the policy (feeds excepted),
 * the prefetch rules on a public page and the day-long edge lifetime on a shared response that names none. An image or
 * a feed may be embedded by another origin (corpFor).
 */
function applyDocumentHeaders(
  headers: Headers,
  { reportTo, csp, publicPage }: { reportTo: string; csp: string; publicPage: boolean },
) {
  applySecurityHeaders(headers);
  headers.set("Cross-Origin-Resource-Policy", corpFor(headers.get("content-type")));
  headers.set("Reporting-Endpoints", reportTo);
  if (!isUnpolicedType(headers.get("content-type"))) {
    headers.set("Content-Security-Policy", csp);
  }
  // Public HTML only: the signed-in planes never prefetch.
  if (publicPage && (headers.get("content-type") ?? "").startsWith("text/html")) {
    headers.set(SPECULATION_RULES_HEADER.name, SPECULATION_RULES_HEADER.value);
  }
  if (headers.get("cache-control") === SHARED_CACHE_CONTROL && !headers.has(EDGE_CACHE_HEADER)) {
    headers.set(EDGE_CACHE_HEADER, EDGE_CACHE_CONTROL);
  }
}

const CARREL_API_PREFIX = "/api/carrel/v1/";
const isCarrelApiPath = (pathname: string) => pathname.startsWith(CARREL_API_PREFIX);

/**
 * The cacheable entrypoint; `default` has cache disabled. Document headers belong here, or they are absent from every hit.
 */
export class Renderer extends withPurgePages(WorkerEntrypoint<Env, RendererProps>) {
  /**
   * site-runtime's purge RPC, which purgeAfterWrite calls after a Carrel write and schedulePurgeHook after a schedule
   * (app/lib/carrel/site-api.server.ts): every page that shows a post carries `posts` (cacheTags). A failure is kept
   * where /health reads it (app/lib/purge-record.server.ts) until a purge succeeds, so a stale site is seen.
   */
  override async purgePages(why: string, tags: string[] = [cacheTags()]) {
    const purged = await super.purgePages(why, tags);
    await recordPurge(this.env, why, purged);
    return purged;
  }

  override async fetch(request: Request): Promise<Response> {
    const env = this.env;
    const ctx = this.ctx;
    const url = new URL(request.url);

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    // For the Carrel preview, which renders a page through the same routes without a second fetch.
    context.set(documentHandlerContext, requestHandler);

    // The private planes only (/admin, /lab): a public page is edge-cached with its header, so a nonce there would be shared
    // by every reader; it runs no inline script, only same-origin files (workers/csp.mjs).
    const adminNonce = isPrivatePath(url.pathname) ? generateNonce() : undefined;
    context.set(nonceContext, adminNonce);

    // Server-Timing on every response (site-runtime ./server-timing): `render`, and each loader's marks. The
    // response comes back with mutable headers, rebuilt when the handler's were not (`Response.redirect()`).
    const response = await timedRender((marks) => {
      context.set(timingsContext, { timings: marks });
      return requestHandler(request, context);
    });

    // Absolute https (the gateway has already redirected plaintext): `Reporting-Endpoints` ignores anything else.
    const reportTo = reportingEndpoints(CSP_ENDPOINT_NAME, new URL(CSP_REPORT_PATH, url.origin));
    const csp = contentSecurityPolicy(url.pathname, adminNonce);
    applyDocumentHeaders(response.headers, { reportTo, csp, publicPage: !isPrivatePath(url.pathname) });

    // Every HTML page: the preloads root.tsx links, as the `Link` header Cloudflare Early Hints reads. Appended,
    // because a post already sends its markdown alternate and webmention endpoint in `Link`.
    const hinted = withPreloadHeader(response, PRELOADS.header);
    // Carrel's API (the site-api package) answers its own `no-store` on every response, refusals included, and the
    // family's site-api-live check reads it exactly; it is no page and no cookie, so the downgrade below is not its.
    if (isCarrelApiPath(url.pathname) && hinted.headers.get("cache-control") === "no-store") return hinted;
    // Last: anything not a shared 200, setting a cookie, rendered for a HEAD or for a cookie other than the theme (which
    // the key holds) leaves private, no-store with no edge header or tag.
    return settleCacheHeaders(hinted, request, { publicCookies: [THEME_COOKIE] });
  }
}

/**
 * A gateway redirect: 301 for GET and HEAD, 308 otherwise so a form body survives, with the security set, since it
 * never passes through the Renderer. `no-store` is load-bearing: the scheme is not in the cache key, so a stored HTTPS
 * redirect would loop HTTPS readers, and a stored rename would outlive a change to the map.
 */
function redirectTo(request: Request, location: string) {
  return new Response(null, {
    status: httpsRedirectStatus(request.method),
    headers: { ...SECURITY_HEADERS, Location: location, "Cache-Control": "no-store" },
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
const site = {
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

  // The one cron (wrangler.jsonc.example), every minute: every Carrel schedule that is due goes live with the publish
  // hooks (IndexNow, the purge, webmentions), failed hooks run again and the trash past 30 days is emptied; at 05:00 UTC the nightly D1 dump runs too. runJobs records each job in cron_runs for /health's
  // cron check and throws after the pass when one failed, so the invocation is recorded as failed and the next firing
  // retries it. Each job's interval and timeout are CRON_JOBS (app/lib/cron-jobs.mjs), the list /health checks.
  // Every firing of the one key gets the job list: there is no other key this Worker can receive.
  // Imported here, not at the top: the gateway never loads the save path, and neither does the test entry.
  scheduled(controller, env, ctx) {
    const at = new Date(controller.scheduledTime);
    ctx.waitUntil(
      runJobs(env.DB, [
        {
          ...cronJob("carrel-schedules"),
          run: async () => {
            const { runCarrelSchedules } = await import("~/lib/carrel/site-api.server");
            const run = await runCarrelSchedules(env, ctx, at);
            if (run.failed > 0) throw new Error(`${run.failed} schedule(s) failed; the next firing retries them`);
          },
        },
        ...(isNightly(at)
          ? [{ ...cronJob("backup"), run: async () => (await import("~/lib/backup/d1-backup.server")).backupD1(env) }]
          : []),
      ]),
    );
  },

} satisfies ExportedHandler<Env>;

// A person idle for an hour on either private plane, /admin or /lab, is signed out of Access (site-runtime ./access).
// Each plane is its own Access application with its own token, so each keeps its own seen cookie: moving between them
// never reads the other's cookie as no request. Every request writes one `request` line
// (site-runtime withRequestLog: cf-ray, method, path, status, ms and the deployed sha), with no address, cookie or
// query, so it records nothing the privacy page would have to name. tokenPath cuts any segment after /preview/, the
// one address a capability has ridden in a path here (the traces note in wrangler.jsonc.example).
//
// NO 404 COUNTER (area 8, N1 and N7): site-runtime's countNotFound would store each missing path and its referring
// host in D1, and the privacy page names everything the site records, so the counter waits for that page's wording.
// With no rows there is nothing to prune.
export default {
  ...site,
  fetch: withRequestLog(
    // The wrapper types the request as a plain Request; it hands on the one the runtime gave it.
    (request: Request, env: Env, ctx: ExecutionContext) => {
      const app = () => site.fetch(request as FetchArgs[0], env, ctx);
      const lab = () => withAdminIdle(request, app, { prefixes: ["/lab"], cookieName: "__Host-lab-seen" });
      return withAdminIdle(request, lab, { prefixes: ["/admin"] });
    },
    { sha: (env: Env) => (env as { DEPLOY_SHA?: string }).DEPLOY_SHA, tokenPath: /\/preview\/[^/?#\s'"]+/g },
  ),
} satisfies ExportedHandler<Env>;

async function gateway(...[request, , ctx]: FetchArgs): Promise<Response> {
  // First, so `http://www/x` is one hop to `https://apex/x` and not two, an old WordPress address included.
  const url = new URL(request.url);
  const apex = wwwRedirectTarget(url.hostname, url.pathname, url.search);
  if (apex !== null) return redirectTo(request, apex);

  // The old WordPress addresses, on the apex host only: the new site's own paths never reach this map.
  const wordpress = isApexHost(url.hostname) ? wordpressDisposition(url.pathname) : null;

  // One hop to https and the slashless path (site-runtime ./url). A paper keeps its slash (below), and an old
  // WordPress address keeps its own, so the map moves it in the same hop.
  const canonical = canonicalRedirect(request, { except: wordpress ? [url.pathname] : [`${PUBLICATIONS_PREFIX}*`] });
  if (canonical !== null) {
    applySecurityHeaders(canonical.headers);
    return canonical;
  }

  // The prefetch rules every public page's header names: one file, the same for every page, so no route renders it.
  if (url.pathname === SPECULATION_RULES_PATH) {
    const rules = speculationRulesResponse({ exclude: PREFETCH_EXCLUDE }, request);
    applySecurityHeaders(rules.headers);
    return rules;
  }

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

  const response = await ctx.exports.Renderer({ props }).fetch(forRenderer(gone ? new Request(gone, request) : request), {
    cf: { cacheKey },
  });

  // Tells browsers and proxies not to hold a per-reader document, any cookie but the theme the key holds counting;
  // a reader who already holds the page gets a 304. Not in the Renderer, whose response is the one the platform stores.
  return forReader(response, request, { publicCookies: [THEME_COOKIE] });
}