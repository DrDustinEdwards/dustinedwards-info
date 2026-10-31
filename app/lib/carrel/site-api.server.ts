// Mounts the site-api package for one request: the adapter, Carrel's key and the site's limiter.
// Here rather than in the route because the key is a secret, and secrets are read only in .server
// modules (check:secrets).

import { submitIndexNow } from "@drdustinedwards/site-helpers/indexnow";
import {
  createSiteApi,
  indexNowHook,
  webmentionHook,
  type PublishHook,
  type RateLimiter,
  type ScheduleRun,
} from "@dustinedwards/site-api";
import { d1SiteApiStore } from "@dustinedwards/site-api/store";
import { schedulePurgeHook } from "@dustinedwards/site-runtime/edge-cache";
import { data, type RouterContextProvider } from "react-router";

import { carrelSiteAdapter } from "~/lib/carrel/site-adapter.server";
import { documentHandlerContext, getEnv, getExecutionContext } from "~/lib/context";
import { INDEXNOW_KEY } from "~/lib/indexnow.mjs";
import { limitHit } from "~/lib/rate-limit.mjs";
import { SITE_ORIGIN } from "~/lib/seo";

type RenderDocument = Parameters<typeof carrelSiteAdapter>[0]["renderDocument"];

const CARREL_RATE_LIMIT = 120;
const CARREL_RATE_PERIOD_SECONDS = 60;

/**
 * The site's own limiter, the ASK_BUDGET Durable Object, under a `carrel:` prefix. Not a `ratelimit`
 * binding: measured here, that binding refused 1, 2, 9 and 0 of twelve concurrent requests against a
 * limit of five (wrangler.jsonc.example). A missing limiter throws, which the package fails closed on.
 */
function carrelLimiter(env: Env): RateLimiter {
  return {
    async limit({ key }) {
      const verdict = await limitHit(env, `carrel:${key}`, CARREL_RATE_LIMIT, CARREL_RATE_PERIOD_SECONDS);
      if (verdict.status === "unavailable") throw new Error("the rate limiter is unavailable");
      return { success: verdict.status === "ok" };
    },
  };
}

/**
 * A request from another origin (a preview, localhost, a test) sends nothing, as indexNowHook already does: the hook
 * reads and announces the live page at SITE_ORIGIN, which that request did not change. A schedule has no request.
 */
const fromThisSite = (hook: PublishHook): PublishHook => ({
  ...hook,
  run: (event) => (event.request && new URL(event.request.url).origin !== SITE_ORIGIN ? true : hook.run(event)),
});

/**
 * The package for one request or one cron pass. The store (drizzle/0037_site_api_store.sql) makes every write safe to
 * send again under its change id, keeps Carrel's preview links, retries a failed hook from the cron, and remembers
 * which pages each post last sent a webmention to. A changed live page tells IndexNow and the pages it links to; a
 * schedule has no request, and the cron's entrypoint cannot reach the Renderer's cache, so its change purges the stored
 * pages through the Renderer (workers/app.ts purgePages). A request's save purges inside savePost.
 */
function carrelApi(env: Env, ctx: ExecutionContext, origin: string, renderDocument: RenderDocument) {
  const store = d1SiteApiStore(env.DB);
  return createSiteApi({
    adapter: carrelSiteAdapter({ env, ctx, origin, renderDocument }),
    key: env.CARREL_SITE_KEY,
    limiter: carrelLimiter(env),
    log: (entry) => console.log(JSON.stringify(entry)),
    store,
    hooks: [
      indexNowHook({ submit: submitIndexNow, origin: SITE_ORIGIN, key: INDEXNOW_KEY }),
      schedulePurgeHook(),
      fromThisSite(webmentionHook({ store })),
    ],
  });
}

const forRequest = (request: Request, context: Readonly<RouterContextProvider>) =>
  carrelApi(getEnv(context), getExecutionContext(context), new URL(request.url).origin, context.get(documentHandlerContext));

/** The package guards in order: prefix, rate limit, key, route. Off the prefix is a 404. */
export async function handleCarrelRequest(
  request: Request,
  context: Readonly<RouterContextProvider>,
): Promise<Response> {
  const api = forRequest(request, context);
  if (!api.matches(request)) throw data("Not found", { status: 404 });
  return api.handle(request, getExecutionContext(context));
}

/**
 * A preview link Carrel made (`/preview/<token>`, no key, app/routes/preview.$token.ts): the post's current source
 * through the site's own page, noindex, never stored, sent with no referrer, so the token (the address) goes nowhere.
 */
export async function handleCarrelPreviewLink(
  request: Request,
  context: Readonly<RouterContextProvider>,
): Promise<Response> {
  const api = forRequest(request, context);
  if (!api.matchesPreviewLink(request)) throw data("Not found", { status: 404 });
  return api.servePreviewLink(request);
}

/**
 * The cron's half (workers/app.ts scheduled(), every minute): puts every schedule that is due live and runs the hooks
 * for each, runs again the hooks that failed, and deletes what has been in the trash 30 days. No request, so no
 * preview renderer; nothing it does previews.
 */
export function runCarrelSchedules(env: Env, ctx: ExecutionContext, now: Date): Promise<ScheduleRun> {
  return carrelApi(env, ctx, SITE_ORIGIN, null).runSchedules({ now });
}
