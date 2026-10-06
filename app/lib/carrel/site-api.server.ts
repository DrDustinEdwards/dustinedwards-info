// Mounts the site-api package for one request: the adapter, Carrel's key and the site's limiter.
// Here rather than in the route because the key is a secret, and secrets are read only in .server
// modules (check:secrets).

import { createSiteApi, type RateLimiter } from "@dustinedwards/site-api";
import { data, type RouterContextProvider } from "react-router";

import { carrelSiteAdapter } from "~/lib/carrel/site-adapter.server";
import { documentHandlerContext, getEnv, getExecutionContext } from "~/lib/context";
import { limitHit } from "~/lib/rate-limit.mjs";

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

/** The package guards in order: prefix, rate limit, key, route. Off the prefix is a 404. */
export async function handleCarrelRequest(
  request: Request,
  context: Readonly<RouterContextProvider>,
): Promise<Response> {
  const env = getEnv(context);
  const api = createSiteApi({
    adapter: carrelSiteAdapter({
      env,
      ctx: getExecutionContext(context),
      origin: new URL(request.url).origin,
      renderDocument: context.get(documentHandlerContext),
    }),
    key: env.CARREL_SITE_KEY,
    limiter: carrelLimiter(env),
  });
  if (!api.matches(request)) throw data("Not found", { status: 404 });
  return api.handle(request);
}
