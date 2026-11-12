// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { LAB_BENCH_PATH } from "~/lab/path.mjs";
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext, documentHandlerContext, cspNonceContext } from "~/lib/context";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { cacheTags, EDGE_CACHE_CONTROL, EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL } from "~/lib/seo";
import { THEME_COOKIE } from "capsomer/theme-server";
import { isApexHost, wordpressDisposition, wwwRedirectTarget } from "~/lib/wordpress-redirects.mjs";
import { PUBLICATIONS_PREFIX, paperSlashTarget } from "~/lib/publications/pdf-redirect.mjs";
import { themeFromRequest } from "~/lib/theme";
import { timingsContext } from "~/lib/timing";
import { isMediaPath, isPrivatePath } from "./csp.mjs";
import { withAdminIdle } from "@dustinedwards/site-runtime/access";
import { applyHeaderSet, UPLOAD_HEADERS } from "@dustinedwards/site-runtime/headers";
import {
  cacheKey,
  forReader,
  forRenderer,
  settleCacheHeaders,
  withPurgePages,
} from "@dustinedwards/site-runtime/edge-cache";
import { withPreloadHeader } from "@dustinedwards/site-runtime/preload";
import { timedRender } from "@dustinedwards/site-runtime/server-timing";
import { canonicalRedirect, redirectStatus } from "@dustinedwards/site-runtime/url";
import {
  SPECULATION_RULES_HEADER,
  SPECULATION_RULES_PATH,
  speculationRulesResponse,
} from "@dustinedwards/site-runtime/prefetch";
import { nonceFor, SECURITY_HEADERS, withSecurityHeaders } from "./security-headers.mjs";
import { handleMediaEvents } from "./media-events";
import { handleWebmentionVerify } from "./webmention-verify";
import { WEBMENTION_VERIFY_QUEUE } from "~/lib/webmention/queue";
import { isWorkerPreview } from "@dustinedwards/site-runtime/http";
import { PRELOADS } from "~/lib/preloads";
import { runJobs } from "@dustinedwards/site-runtime/cron";
import { maintenanceOn, maintenanceResponse } from "@dustinedwards/site-runtime/maintenance";
import { routeNamer, withRequestLog } from "@dustinedwards/site-runtime/log";
import { countNotFound } from "@dustinedwards/site-runtime/not-found";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { SITE_ORIGIN } from "~/lib/seo";

export { AskBudget } from "./ask-budget";

const serverBuild = () => import("virtual:react-router/server-build");
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

// The route pattern each `request` log line names (`/blog/:slug`), from the React Router build's route table, made once
// per isolate (site-runtime ./log's routeNamer). Requests the Worker answers itself (/api, /health, /mcp, /media) carry
// the path alone. The build loads beside the request, so the first few lines in an isolate may go without a route.
let nameRoute: ((request: Request) => string | undefined) | undefined;
function routeName(request: Request): string | undefined {
  if (!nameRoute)
    void serverBuild().then(
      (build) => (nameRoute ??= routeNamer(build.routes)),
      () => undefined,
    );
  return /^\/(api|health|mcp|media)(\/|$)/.test(new URL(request.url).pathname)
    ? undefined
    : nameRoute?.(request);
}

// site-runtime's `cacheKey`: the path and the query without tracking parameters, plus the theme an HTML read is
// rendered in. The platform cache is the only cache; do not add `caches.default`.
export type RendererProps = { theme?: string };

export function cacheDimensions(
  url: URL,
  request: Request,
  theme: string,
): { cacheKey: string; props: RendererProps } {
  const themed =
    request.method === "GET" && !isPrivatePath(url.pathname) && !negotiatesAwayFromHtml(request);

  if (!themed) return { cacheKey: cacheKey(url), props: {} };
  return { cacheKey: cacheKey(url, { dimensions: { theme } }), props: { theme } };
}

// The shared package's apply, authoritative: this site's set wins over anything a route set.
function applySecurityHeaders(headers: Headers) {
  applyHeaderSet(headers, SECURITY_HEADERS);
}

/**
 * Hover prefetch (site-runtime ./prefetch): the rules beyond the package's own exclusions. /lab-bench is signed in,
 * /media is files, /login and /theme act on a request, and `/search/ask` is billed: prefetching it would spend
 * model tokens on a click nobody made. File links (.md, .xml, .json, .txt) and links with a query are the
 * package's defaults.
 */
const PREFETCH_EXCLUDE = [LAB_BENCH_PATH, "/media", "/login", "/theme", "/search/ask"];

/**
 * What a rendered response leaves with beyond the security set (site-runtime pageSecurity, applied in the Renderer): the
 * prefetch rules on a public page and the day-long edge lifetime on a shared response that names none.
 */
function applyDocumentHeaders(headers: Headers, { publicPage }: { publicPage: boolean }) {
  // Public HTML only: the signed-in planes never prefetch.
  if (publicPage && (headers.get("content-type") ?? "").startsWith("text/html")) {
    headers.set(SPECULATION_RULES_HEADER.name, SPECULATION_RULES_HEADER.value);
  }
  if (headers.get("cache-control") === SHARED_CACHE_CONTROL && !headers.has(EDGE_CACHE_HEADER)) {
    headers.set(EDGE_CACHE_HEADER, EDGE_CACHE_CONTROL);
  }
}

/**
 * The cacheable entrypoint; `default` has cache disabled. Document headers belong here, or they are absent from every hit.
 */
export class Renderer extends withPurgePages(WorkerEntrypoint<Env, RendererProps>, {
  kv: (env: Env) => env.APP_KV,
}) {
  /**
   * site-runtime's purge RPC, which purgeAfterWrite calls after a Carrel write and schedulePurgeHook after a schedule
   * (app/lib/carrel/site-api.server.ts): the cron's entrypoint cannot reach this one's cache. Every page that shows a
   * post carries `posts` (cacheTags). RPC methods bypass the cache. A failure is kept in KV until a purge succeeds,
   * where /health's cache-purge check reads it.
   */
  override async purgePages(why: string, tags: string[] = [cacheTags()]) {
    return super.purgePages(why, tags);
  }

  override async fetch(request: Request): Promise<Response> {
    const env = this.env;
    const ctx = this.ctx;
    const url = new URL(request.url);

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    // For the Carrel preview, which renders a page through the same routes without a second fetch.
    context.set(documentHandlerContext, requestHandler);

    // The private planes only (/admin, /lab-bench): a public page is edge-cached with its header, so a nonce there would be shared
    // by every reader; it runs no inline script, only same-origin files (workers/csp.mjs pagePolicy).
    const adminNonce = isPrivatePath(url.pathname) ? nonceFor(request) : undefined;
    context.set(cspNonceContext, adminNonce ?? null);

    // Server-Timing on every response (site-runtime ./server-timing): `render`, and each loader's marks. The
    // response comes back with mutable headers, rebuilt when the handler's were not (`Response.redirect()`).
    const response = await timedRender((marks) => {
      context.set(timingsContext, { timings: marks });
      return requestHandler(request, context);
    });

    // Every /media response, whatever its type: stored bytes are never a page of this site, so they carry UPLOAD_HEADERS'
    // sandboxed default-src 'none' (an SVG or an HTML body cannot run as the site), which pageSecurity leaves alone as the
    // route's own. TRAP: `sandbox` breaks Chrome's built-in PDF viewer; no PDF is served from /media, and one must never be.
    const media = isMediaPath(url.pathname)
      ? withHeader(
          response,
          "Content-Security-Policy",
          UPLOAD_HEADERS["Content-Security-Policy"] as string,
        )
      : response;
    const secured = withSecurityHeaders(media, request, adminNonce);
    applyDocumentHeaders(secured.headers, { publicPage: !isPrivatePath(url.pathname) });
    // Every HTML page: the preloads root.tsx links, as the `Link` header Cloudflare Early Hints reads. Appended,
    // because a post already sends its markdown alternate and webmention endpoint in `Link`.
    const hinted = withPreloadHeader(secured, PRELOADS.header);
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
    status: redirectStatus(request.method),
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
    // Each 404 a GET gets, stored page or live, counted per path, referring host and UTC day (site-runtime
    // ./not-found, drizzle/0041; the privacy page names it). Never a preview link's, whose path carries its token.
    if (!new URL(request.url).pathname.startsWith("/preview/"))
      countNotFound(env.DB, request, response, ctx);
    // Every exit, redirects included, which never pass through applyDocumentHeaders. Static assets
    // are served before the Worker runs, so robots.txt's Disallow is what covers those.
    // The workers.dev address keeps answering after the cutover (the browser tests and
    // the sign-in fallback use it), so it is kept out of the index here rather than redirected away.
    // robots.txt must not disallow it, or a crawler never reads this header.
    const unindexed =
      isWorkerPreview(env) || new URL(request.url).hostname.endsWith(".workers.dev");
    return unindexed ? withHeader(response, "X-Robots-Tag", "noindex") : response;
  },

  async queue(batch, env) {
    if (batch.queue === WEBMENTION_VERIFY_QUEUE) await handleWebmentionVerify(batch, env);
    else await handleMediaEvents(batch, env);
  },

  // The one cron (wrangler.jsonc.example), every minute: each job in siteJobs (app/lib/cron-run.server.ts) that is due
  // at this firing. runJobs records each job in cron_runs for /health's cron check and throws after the pass when one
  // failed, so the invocation is recorded as failed and the next firing retries it. The operator API's run_job runs
  // any of the same jobs now. Every firing of the one key gets the job list: there is no other key this Worker can receive.
  scheduled(controller, env, ctx) {
    const at = new Date(controller.scheduledTime);
    ctx.waitUntil(
      import("~/lib/cron-run.server").then(({ siteJobs }) =>
        runJobs(
          env.DB,
          siteJobs(env, ctx, at).filter((job) => job.due(at)),
        ),
      ),
    );
  },
} satisfies ExportedHandler<Env>;

// Prelum's markdownCopies: every public page has a Markdown copy at its path plus .md and answers Accept: text/markdown,
// which llms.txt promises. The site's own twins (posts, papers, research, the CV) and its own llms-full.txt win; the
// wrapper only fills in the pages the site answers 404 or HTML for. The private planes get no copy.
const withMarkdownCopies = markdownCopies(
  // The wrapper types the request as a plain Request; it hands on the one the runtime gave it, or a GET it made from it.
  (request: Request, env: Env, ctx: ExecutionContext) =>
    site.fetch(request as FetchArgs[0], env, ctx),
  { origin: SITE_ORIGIN, llmsFull: false, siteMarkdown: false, skip: isPrivatePath },
);

// A person idle for an hour on either private plane, /admin or /lab-bench, is signed out of Access (site-runtime ./access).
// Each plane is its own Access application with its own token, so each keeps its own seen cookie: moving between them
// never reads the other's cookie as no request. Every request writes one `request` line
// (site-runtime withRequestLog: cf-ray, method, path, status, ms and the deployed sha), with no address, cookie or
// query, so it records nothing the privacy page would have to name. tokenPath cuts any segment after /preview/, the
// one address a capability has ridden in a path here (the traces note in wrangler.jsonc.example).
export default {
  ...site,
  fetch: withRequestLog(
    // The wrapper types the request as a plain Request; it hands on the one the runtime gave it.
    (request: Request, env: Env, ctx: ExecutionContext) => {
      const app = async () => withMarkdownCopies(request, env, ctx);
      const secret = env.ADMIN_IDLE_SECRET;
      const lab = () =>
        withAdminIdle(request, app, {
          prefixes: [LAB_BENCH_PATH],
          cookieName: "__Host-lab-seen",
          secret,
        });
      return withAdminIdle(request, lab, { prefixes: ["/admin"], secret });
    },
    {
      sha: (env: Env) => (env as { DEPLOY_SHA?: string }).DEPLOY_SHA,
      tokenPath: /\/preview\/[^/?#\s'"]+/g,
      route: routeName,
    },
  ),
} satisfies ExportedHandler<Env>;

async function gateway(...[request, env, ctx]: FetchArgs): Promise<Response> {
  // First, so `http://www/x` is one hop to `https://apex/x` and not two, an old WordPress address included.
  const url = new URL(request.url);
  const apex = wwwRedirectTarget(url.hostname, url.pathname, url.search);
  if (apex !== null) return redirectTo(request, apex);

  // The old WordPress addresses, on the apex host only: the new site's own paths never reach this map.
  const wordpress = isApexHost(url.hostname) ? wordpressDisposition(url.pathname) : null;

  // One hop to https and the slashless path (site-runtime ./url). A paper keeps its slash (below), and an old
  // WordPress address keeps its own, so the map moves it in the same hop.
  const canonical = canonicalRedirect(request, {
    except: wordpress ? [url.pathname] : [`${PUBLICATIONS_PREFIX}*`],
  });
  if (canonical !== null) {
    applySecurityHeaders(canonical.headers);
    return canonical;
  }

  // The maintenance page (site-runtime ./maintenance): every path but /health answers 503 while the MAINTENANCE var is
  // on. A dashboard var, not a secret, so it is not in Env (app/env.d.ts lists only the secrets).
  if (maintenanceOn(env as Env & { MAINTENANCE?: string }) && url.pathname !== "/health") {
    const down = maintenanceResponse({ siteName: "Dustin Edwards" });
    applySecurityHeaders(down.headers);
    return down;
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
  if (slashed !== null)
    return redirectTo(request, new URL(`${slashed}${url.search}`, url).toString());

  // A removed WordPress address renders the Gone page in its place: the address bar keeps the old URL
  // and the status is 410. Every redirect above was decided first; none of them names a removed path.
  const gone = wordpress?.status === 410 ? new URL("/gone", url) : null;

  const theme = themeFromRequest(request);
  const { cacheKey, props } = cacheDimensions(gone ?? url, request, theme);

  const response = await ctx.exports
    .Renderer({ props })
    .fetch(forRenderer(gone ? new Request(gone, request) : request), {
      cf: { cacheKey },
    });

  // Tells browsers and proxies not to hold a per-reader document, any cookie but the theme the key holds counting;
  // a reader who already holds the page gets a 304. Not in the Renderer, whose response is the one the platform stores.
  return forReader(await tombstoned(response, url.pathname, d1SiteApiStore(env.DB)), request, {
    publicCookies: [THEME_COOKIE],
  });
}
