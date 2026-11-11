/**
 * /health: site-runtime's healthResponse, the site's one health endpoint. The outside reads it (the UptimeRobot
 * monitor, Capsid's watcher, the network's ops audit, Capsomer's network board), and so do the instruments that act
 * on it: Capsid's watcher (which repairs drift), ship's readiness, operator-sync and the admin MCP, each through
 * healthChecks in app/lib/health/rows.mjs. The answer itself is app/lib/health/response.server.ts, which the
 * health-snapshot cron job also runs for the colophon. Rate limited, because the drift checks cost.
 */

import { logEvent } from "@dustinedwards/site-runtime/log";

import { clientIp } from "@dustinedwards/site-runtime/http";
import { getEnv } from "~/lib/context";
import { limitHit } from "~/lib/rate-limit.mjs";
import { siteHealthResponse } from "~/lib/health/response.server";

import type { Route } from "./+types/health";

// The same three headers healthResponse sends, so a refusal is no more cacheable or indexable than an answer.
const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/health+json; charset=utf-8",
  "X-Robots-Tag": "noindex",
};

function refusal(name: string, status: number, extra: Record<string, string> = {}): Response {
  const body = {
    status: "fail",
    ok: false,
    time: new Date().toISOString(),
    checks: [{ name, status: "fail" }],
  };
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  let verdict: Awaited<ReturnType<typeof limitHit>>;
  try {
    verdict = await limitHit(env, `health:${clientIp(request)}`, 20, 60);
  } catch (error) {
    logEvent("health_rate_limiter_threw", { error }, { level: "error" });
    return refusal("rate-limiter-failed", 503);
  }
  if (verdict.status === "unavailable") return refusal("rate-limiter-unavailable", 503);
  if (verdict.status === "limited") {
    return refusal("rate-limited", 429, { "Retry-After": String(verdict.retryAfterSeconds) });
  }

  return siteHealthResponse(env);
}
