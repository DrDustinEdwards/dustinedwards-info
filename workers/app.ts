// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { LAB_BENCH_PATH } from "~/lab/path.mjs";

import { documentHandlerContext } from "~/lib/context";
import { negotiatesAwayFromHtml } from "~/lib/negotiate.mjs";
import { cacheTags, ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/seo";
import { THEME_COOKIE } from "capsomer/theme-server";
import { isApexHost, wordpressDisposition, wwwRedirectTarget } from "~/lib/wordpress-redirects.mjs";
import { PUBLICATIONS_PREFIX, paperSlashTarget } from "~/lib/publications/pdf-redirect.mjs";
import { isMediaPath, isPrivatePath } from "./csp.mjs";
import { UPLOAD_HEADERS } from "@dustinedwards/site-runtime/headers";
import { privateRender } from "@dustinedwards/site-runtime/edge-cache";
import { isWorkerPreview, redirectResponse } from "@dustinedwards/site-runtime/http";
import { redirectStatus } from "@dustinedwards/site-runtime/url";
import { defineSite, siteRenderer, siteWorker } from "@dustinedwards/site-runtime/worker";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { standardFiles } from "@drdustinedwards/site-helpers/files";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { withSecurityHeaders } from "./security-headers.mjs";
import { handleMediaEvents } from "./media-events";
import { carrelStep } from "~/lib/carrel/site-api.server";
import { handleWebmentionVerify } from "./webmention-verify";
import { WEBMENTION_VERIFY_QUEUE } from "~/lib/webmention/queue";
import { PAGE_PRELOADS } from "~/lib/preloads";

export { AskBudget } from "./ask-budget";

/**
 * The site on site-runtime's one Worker (./worker): the gateway, the Renderer the Workers cache stores pages from, the
 * request log and the cron. What follows is only what is this site's own. The platform cache is the only cache; do not
 * add `caches.default`.
 */
const site = defineSite<Env>({
  name: "Dustin Edwards",
  serverBuild: () => import("virtual:react-router/server-build"),
  mode: import.meta.env.MODE,
  // Every /media response, whatever its type: stored bytes are never a page of this site, so they carry UPLOAD_HEADERS'
  // sandboxed default-src 'none' (an SVG or an HTML body cannot run as the site), which pageSecurity leaves alone as the
  // route's own. TRAP: `sandbox` breaks Chrome's built-in PDF viewer; no PDF is served from /media, and one must never be.
  withSecurityHeaders: (response, request, nonce) =>
    withSecurityHeaders(
      isMediaPath(new URL(request.url).pathname)
        ? withHeader(
            response,
            "Content-Security-Policy",
            UPLOAD_HEADERS["Content-Security-Policy"] as string,
          )
        : response,
      request,
      nonce,
    ),
  canonical: {
    // The www host and the old WordPress addresses, before the https and slash hop: `http://www/x` is one hop to
    // `https://apex/x`, an old WordPress address included, and a paper's address takes its slash (Scholar honors
    // `citation_pdf_url` only in the page's subdirectory). Decided without the database, before the cache.
    before: earlierMove,
    // A paper keeps its slash, and so does an old WordPress address, which the map answers.
    except: [`${PUBLICATIONS_PREFIX}*`],
    keep: (url) => isApexHost(url.hostname) && wordpressDisposition(url.pathname) !== null,
  },
  // Prelum's robots.txt and ai.txt. A request on any other origin (a Worker Preview, a PR's draft of the site) tells
  // every crawler `Disallow: /`, with no-store and noindex. The real controls: `X-Robots-Tag` and `no-store` on
  // /preview, and POST-only on /search/ask, which is disallowed because every answer is billed. ai.txt is the family's
  // AI usage policy: answer engines may cite and link, training rights are reserved (the TDMRep header says the same)
  // and licensed on request. site.webmanifest and the IndexNow key file stay routes: standardFiles would change their
  // Content-Type and Cache-Control.
  files: standardFiles({
    origin: SITE_ORIGIN,
    disallow: ROBOTS_DISALLOW,
    ai: { name: "Dustin Edwards", contact: "contact@dustinedwards.info" },
  }),
  // /lab-bench and /admin are signed in, /media is files, /login and /theme act on a request, and `/search/ask` is billed:
  // prefetching it would spend model tokens on a click nobody made.
  speculationExclude: [LAB_BENCH_PATH, "/admin", "/media", "/login", "/theme", "/search/ask"],
  steps: [
    // A removed WordPress address renders the Gone page in its place: the address bar keeps the old URL and the
    // status is 410. Rendered for this reader, never stored under the old address.
    async (request, _env, _ctx, kit) =>
      isApexHost(kit.url.hostname) && wordpressDisposition(kit.url.pathname)?.status === 410
        ? privateRender(await kit.render(new Request(new URL("/gone", kit.url), request)))
        : undefined,
    // Carrel's site API under /api/carrel/v1 and its preview links (site-api's step); an accepted write purges.
    carrelStep,
  ],
  // A webmention is a cross-site POST by design (W3C Webmention 3.2).
  crossSiteExempt: ["/webmention"],
  publicCookies: [THEME_COOKIE],
  // The signed-in planes are rendered for their reader alone. A request that negotiates away from HTML (a Markdown twin,
  // search's JSON) is too: the key holds no Accept, so a stored HTML page would answer it.
  cacheable: (request, url) => !isPrivatePath(url.pathname) && !negotiatesAwayFromHtml(request),
  preloads: PAGE_PRELOADS,
  // The admin's media and mentions kit (app/lib/admin-kit.server.ts) previews a post through the same routes in-process,
  // never through the Renderer, whose response is the one the edge stores. Carrel's own preview uses the step's kit.
  context: (context, env, ctx) =>
    context.set(documentHandlerContext, (request, set) => site.render(request, env, ctx, { set })),
  purgeKv: (env) => env.APP_KV,
  onNotFound: (response, request, env) =>
    tombstoned(response, new URL(request.url).pathname, d1SiteApiStore(env.DB)),
  // Prelum's markdownCopies: every public page has a Markdown copy at its path plus .md and answers Accept: text/markdown,
  // which llms.txt promises. The site's own twins (posts, papers, research, the CV) and its own llms-full.txt win; the
  // wrapper only fills in the pages the site answers 404 or HTML for. The private planes get no copy. Then, on every exit:
  // the workers.dev address keeps answering after the cutover (the browser tests and the sign-in fallback use it), so it
  // is kept out of the index here rather than redirected away. robots.txt must not disallow it, or a crawler never reads
  // this header.
  wrap: (handler) => {
    const copies = markdownCopies(handler, {
      origin: SITE_ORIGIN,
      llmsFull: false,
      siteMarkdown: false,
      skip: isPrivatePath,
    });
    return async (request, env, ctx) => {
      const response = await copies(request, env, ctx);
      return isWorkerPreview(env) || new URL(request.url).hostname.endsWith(".workers.dev")
        ? withHeader(response, "X-Robots-Tag", "noindex")
        : response;
    };
  },
  // A person idle for an hour on either private plane is signed out of Access (site-runtime ./access). Each plane is its
  // own Access application with its own token, so each keeps its own seen cookie.
  adminIdle: [
    { prefixes: ["/admin"], secret: (env) => env.ADMIN_IDLE_SECRET },
    {
      prefixes: [LAB_BENCH_PATH],
      cookieName: "__Host-lab-seen",
      secret: (env) => env.ADMIN_IDLE_SECRET,
    },
  ],
  // The one cron (wrangler.jsonc.example), every minute: each job in siteJobs (app/lib/cron-run.server.ts) that is due at
  // this firing. runJobs records each in cron_runs for /health's cron check and throws after the pass when one failed, so
  // the next firing retries it. The operator API's run_job runs any of the same jobs now.
  cron: async (env, at, ctx) => {
    const { siteJobs } = await import("~/lib/cron-run.server");
    return { "* * * * *": siteJobs(env, ctx, at).filter((job) => job.due(at)) };
  },
});

/** The cacheable entrypoint; the gateway has cache disabled. */
export class Renderer extends siteRenderer(WorkerEntrypoint<Env>, site) {
  /**
   * site-runtime's purge RPC, which purgeAfterWrite calls after a Carrel write and schedulePurgeHook after a schedule
   * (app/lib/carrel/site-api.server.ts): the cron's entrypoint cannot reach this one's cache. Every page that shows a
   * post carries `posts` (cacheTags). A failure is kept in KV until a purge succeeds, where /health's cache-purge
   * check reads it.
   */
  override async purgePages(why: string, tags: string[] = [cacheTags()]) {
    return super.purgePages(why, tags);
  }
}

export default {
  ...siteWorker(site),
  async queue(batch, env) {
    if (batch.queue === WEBMENTION_VERIFY_QUEUE) await handleWebmentionVerify(batch, env);
    else await handleMediaEvents(batch, env);
  },
} satisfies ExportedHandler<Env>;

/** The site's own moves, ahead of site-runtime's canonical hop (`canonical.before`). */
function earlierMove(request: Request): Response | null {
  const url = new URL(request.url);
  const apex = wwwRedirectTarget(url.hostname, url.pathname, url.search);
  if (apex !== null) return redirectTo(request, apex);

  // The old WordPress addresses, on the apex host only: the new site's own paths never reach this map.
  const wordpress = isApexHost(url.hostname) ? wordpressDisposition(url.pathname) : null;
  if (wordpress?.status === 301)
    return redirectTo(request, new URL(wordpress.location, url).toString());

  const slashed = paperSlashTarget(url.pathname);
  return slashed === null
    ? null
    : redirectTo(request, new URL(`${slashed}${url.search}`, url).toString());
}

/**
 * A 301 for GET and HEAD, 308 otherwise so a form body survives; the gateway adds the security set. `no-store` is
 * load-bearing: the scheme is not in the cache key, so a stored HTTPS redirect would loop HTTPS readers, and a stored
 * rename would outlive a change to the map.
 */
const redirectTo = (request: Request, location: string) =>
  redirectResponse(location, redirectStatus(request.method));

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
