// Mounts the site-api package for one request: the adapter, Carrel's key and the site's limiter.
// Here rather than in workers/app.ts's options because the key is a secret, and secrets are read only in .server
// modules (check:secrets).

import {
  siteApiStep,
  standardSiteApi,
  type PublishHook,
  type RateLimiter,
  type ScheduleRun,
} from "@dustinedwards/site-api";
import type { GatewayStep } from "@dustinedwards/site-runtime/worker";

import { carrelSiteAdapter } from "~/lib/carrel/site-adapter.server";
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
      const verdict = await limitHit(
        env,
        `carrel:${key}`,
        CARREL_RATE_LIMIT,
        CARREL_RATE_PERIOD_SECONDS,
      );
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
  run: (event) =>
    event.request && new URL(event.request.url).origin !== SITE_ORIGIN ? true : hook.run(event),
});

/**
 * The package for one request or one cron pass: site-api's standard store (drizzle/0037_site_api_store.sql) and hooks.
 * The store makes every write safe to send again under its change id, keeps Carrel's preview links, retries a failed
 * hook from the cron, and remembers which pages each post last sent a webmention to. A changed live page tells IndexNow
 * and the pages it links to; a schedule has no request, and the cron's entrypoint cannot reach the Renderer's cache, so
 * its change purges the stored pages through the Renderer (workers/app.ts purgePages).
 */
function carrelApi(
  env: Env,
  ctx: ExecutionContext,
  origin: string,
  renderDocument: RenderDocument,
) {
  return standardSiteApi({
    adapter: carrelSiteAdapter({ env, ctx, origin, renderDocument }),
    key: env.CARREL_SITE_KEY,
    limiter: carrelLimiter(env),
    db: env.DB,
    indexNow: { origin: SITE_ORIGIN, key: INDEXNOW_KEY },
    hooks: (standard) => [standard.indexNow, standard.purge, fromThisSite(standard.webmention)],
  });
}

/**
 * The gateway step (workers/app.ts): Carrel's API under /api/carrel/v1 and its preview links at /preview/<token> (no
 * key, the token is the address; the package answers private, no-store and noindex). The package guards in order:
 * prefix, rate limit, key, route. A preview renders the post through the site's own routes in-process (the kit's
 * render), never through the Renderer, whose response is the one the edge stores. A write it accepts purges the
 * stored pages; each save also purges its own tags (cache-purge.server.ts).
 */
export const carrelStep: GatewayStep<Env> = (request, env, ctx, kit) =>
  siteApiStep<Env>((stepEnv) =>
    carrelApi(stepEnv, ctx, kit.url.origin, (page, set) => kit.render(page, { set })),
  )(request, env, ctx, kit);

/**
 * The cron's half (workers/app.ts scheduled(), every minute): puts every schedule that is due live and runs the hooks
 * for each, runs again the hooks that failed, and deletes what has been in the trash 30 days. No request, so no
 * preview renderer; nothing it does previews.
 */
export function runCarrelSchedules(
  env: Env,
  ctx: ExecutionContext,
  now: Date,
): Promise<ScheduleRun> {
  return carrelApi(env, ctx, SITE_ORIGIN, null).runSchedules({ now });
}
