// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, type ServerBuild } from "react-router";

import { LAB_BENCH_PATH } from "~/lab/path.mjs";
import { documentHandlerContext } from "~/lib/context";
import { cacheTags, SITE_ORIGIN } from "~/lib/seo";
import { THEME_COOKIE } from "capsomer/theme-server";
import { isApexHost, wordpressDisposition, wwwRedirectTarget } from "~/lib/wordpress-redirects.mjs";
import { paperSlashTarget, PUBLICATIONS_PREFIX } from "~/lib/publications/pdf-redirect.mjs";
import { FONT_PRELOADS } from "~/lib/preloads";
import { WEBMENTION_VERIFY_QUEUE } from "~/lib/webmention/queue";
import { isMediaPath, isPrivatePath } from "./csp.mjs";
import { withSecurityHeaders } from "./security-headers.mjs";
import { handleMediaEvents } from "./media-events";
import { handleWebmentionVerify } from "./webmention-verify";
import { generateNonce } from "@dustinedwards/site-runtime/csp";
import { privateRender, UNCACHED } from "@dustinedwards/site-runtime/edge-cache";
import { UPLOAD_HEADERS } from "@dustinedwards/site-runtime/headers";
import { isWorkerPreview } from "@dustinedwards/site-runtime/http";
import { redirectStatus } from "@dustinedwards/site-runtime/url";
import {
  defineSite,
  siteRenderer,
  siteWorker,
  type GatewayStep,
} from "@dustinedwards/site-runtime/worker";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";

export { AskBudget } from "./ask-budget";

const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;

// The Carrel preview renders a page in-process through the same routes and root layout (app/lib/context.ts), never
// through the Renderer, whose answers the edge stores.
const documentHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

/**
 * A move of this site's own, before the canonical one: `www.` to the apex in one hop (an old WordPress address
 * included), an old WordPress address to its new page, and a paper to its slashed form (Scholar honors
 * `citation_pdf_url` only in the page's subdirectory). Each never stored: the scheme is not in the cache key.
 */
function siteMove(request: Request): Response | null {
  const url = new URL(request.url);
  // On https in the same hop, as canonicalRedirect would (the dev server and wrangler serve plaintext on loopback).
  const origin = LOOPBACK.has(url.hostname) ? url.origin : `https://${url.host}`;
  const move = (location: string) =>
    new Response(null, {
      status: redirectStatus(request.method),
      headers: { Location: location, "Cache-Control": UNCACHED },
    });
  const apex = wwwRedirectTarget(url.hostname, url.pathname, url.search);
  if (apex !== null) return move(apex);
  const wordpress = isApexHost(url.hostname) ? wordpressDisposition(url.pathname) : null;
  if (wordpress?.status === 301) return move(new URL(wordpress.location, origin).toString());
  const slashed = paperSlashTarget(url.pathname);
  return slashed === null ? null : move(new URL(`${slashed}${url.search}`, origin).toString());
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Every /media response, whatever its type: stored bytes are never a page of this site, so they carry UPLOAD_HEADERS'
 * sandboxed default-src 'none' (an SVG or an HTML body cannot run as the site), which the security set leaves alone as
 * the response's own. TRAP: `sandbox` breaks Chrome's built-in PDF viewer; no PDF is served from /media, and one must
 * never be.
 */
const media: GatewayStep<Env> = async (request, _env, _ctx, kit) => {
  if (!isMediaPath(kit.url.pathname)) return undefined;
  const file = await kit.render(request);
  const headers = new Headers(file.headers);
  headers.set("Content-Security-Policy", UPLOAD_HEADERS["Content-Security-Policy"] as string);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", UNCACHED);
  return new Response(file.body, { status: file.status, statusText: file.statusText, headers });
};

/**
 * A removed WordPress address renders the Gone page in its place: the address bar keeps the old URL and the status is
 * 410. Every move was decided first; none names a removed path.
 */
const gone: GatewayStep<Env> = async (request, _env, _ctx, kit) => {
  if (!isApexHost(kit.url.hostname) || wordpressDisposition(kit.url.pathname)?.status !== 410)
    return undefined;
  const nonce = generateNonce();
  const page = await kit.render(new Request(new URL("/gone", kit.url), request), { nonce });
  return privateRender(kit.secure(page, request, nonce));
};

/**
 * The workers.dev address keeps answering after the cutover (the browser tests and the sign-in fallback use it), so it
 * is kept out of the index here rather than redirected away; robots.txt must not disallow it, or a crawler never reads
 * this header. Static assets are served before the Worker runs, so robots.txt's Disallow is what covers those.
 */
const unindexed =
  (handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>) =>
  async (request: Request, env: Env, ctx: ExecutionContext) => {
    const response = await handler(request, env, ctx);
    if (!isWorkerPreview(env) && !new URL(request.url).hostname.endsWith(".workers.dev"))
      return response;
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

/**
 * The site's Worker (site-runtime ./worker). What is this site's own: the WordPress and paper moves, the /media upload
 * policy, the Gone page, the theme in the cache key, the two Access planes (/admin and /lab-bench, each its own seen
 * cookie), the Markdown copies (none for the private planes), the purge's `posts` tag, the purge record in KV that
 * /health reads, and the one every-minute cron, whose due jobs run at each firing.
 */
const site = defineSite<Env>({
  name: "Dustin Edwards",
  serverBuild,
  mode: import.meta.env.MODE,
  withSecurityHeaders,
  // A paper keeps its slash (siteMove gives it one), and an old WordPress address keeps its own, so a removed one
  // answers 410 where it was.
  canonical: {
    except: [`${PUBLICATIONS_PREFIX}*`],
    before: siteMove,
    keep: (url) => isApexHost(url.hostname) && wordpressDisposition(url.pathname) !== null,
  },
  // /lab-bench is signed in, /media is files, /login and /theme act on a request, and `/search/ask` is billed:
  // prefetching it would spend model tokens on a click nobody made.
  speculationExclude: [LAB_BENCH_PATH, "/media", "/login", "/theme", "/search/ask"],
  steps: [media, gone],
  publicCookies: [THEME_COOKIE],
  cacheable: (_request, url) => !isPrivatePath(url.pathname),
  preloads: FONT_PRELOADS,
  context: (context) => context.set(documentHandlerContext, documentHandler),
  purgeKv: (env) => env.APP_KV,
  onNotFound: (response, request, env) =>
    tombstoned(response, new URL(request.url).pathname, d1SiteApiStore(env.DB)),
  // Prelum's markdownCopies: every public page has a Markdown copy at its path plus .md and answers Accept:
  // text/markdown, which llms.txt promises. The site's own twins and its own llms-full.txt win.
  wrap: (handler) =>
    unindexed(
      markdownCopies(handler, {
        origin: SITE_ORIGIN,
        llmsFull: false,
        siteMarkdown: false,
        skip: isPrivatePath,
      }),
    ),
  adminIdle: [
    { prefixes: ["/admin"], secret: (env) => env.ADMIN_IDLE_SECRET },
    {
      prefixes: [LAB_BENCH_PATH],
      cookieName: "__Host-lab-seen",
      secret: (env) => env.ADMIN_IDLE_SECRET,
    },
  ],
  // The one cron (wrangler.jsonc.example), every minute: each job in siteJobs (app/lib/cron-run.server.ts) due at this
  // firing. The operator API's run_job runs any of the same jobs now.
  cron: async (env, at, ctx) => {
    const { siteJobs } = await import("~/lib/cron-run.server");
    return { "* * * * *": siteJobs(env, ctx, at).filter((job) => job.due(at)) };
  },
});

/**
 * The cacheable entrypoint. Every page that shows a post carries `posts` (cacheTags), so a purge with no tags named
 * drops those.
 */
export class Renderer extends siteRenderer(WorkerEntrypoint<Env>, site) {
  override async purgePages(why: string, tags: string[] = [cacheTags()]) {
    return super.purgePages(why, tags);
  }
}

const worker = siteWorker(site);

export default {
  ...worker,
  async queue(batch, env) {
    if (batch.queue === WEBMENTION_VERIFY_QUEUE) await handleWebmentionVerify(batch, env);
    else await handleMediaEvents(batch, env);
  },
} satisfies ExportedHandler<Env>;
