/**
 * /health: site-runtime's healthResponse, for the uptime probe and the family's ops audit. 503 only when D1 does not
 * answer. Warnings, never a 503: the newest complete dump older than 26 hours, a binding that does not answer, a cron
 * job that failed or stopped, and every drift check /api/health runs (the site is up while one drifts). /api/health
 * stays the repair instrument the watchdog, ship and the admin MCP read. `sha` is the commit ship deployed
 * (DEPLOY_SHA); a hand deploy has none. Same limiter and budget as /api/health, because the drift checks cost.
 */

import { backupHealth } from "@dustinedwards/d1-dump";
import { cronCheck } from "@dustinedwards/site-runtime/cron";
import { healthResponse, kvCheck, r2Check } from "@dustinedwards/site-runtime/health";
import { logEvent } from "@dustinedwards/site-runtime/log";

import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import { limitHit } from "~/lib/rate-limit.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { CHECK_TIMEOUT_MS } from "~/lib/health/verdicts.mjs";

import type { Route } from "./+types/health";

const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/health+json; charset=utf-8" };

function refusal(name: string, status: number, extra: Record<string, string> = {}): Response {
  const body = { status: "fail", ok: false, time: new Date().toISOString(), checks: [{ name, status: "fail" }] };
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

  // The drift checks run once, beside the binding checks; a detail carries only the two counts, as on /api/health.
  const drift = await runHealthChecks(env);
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    backup: () => backupHealth(env.BACKUPS),
    sha: (env as { DEPLOY_SHA?: string }).DEPLOY_SHA,
    checkTimeoutMs: CHECK_TIMEOUT_MS,
    checks: [
      { ...r2Check("media", env.MEDIA), level: "warn" },
      { ...r2Check("og", env.OG), level: "warn" },
      { ...kvCheck("kv", env.APP_KV), level: "warn" },
      cronCheck(env.DB),
      ...drift.checks.map((check) => ({
        name: check.name,
        level: "warn" as const,
        run: async () =>
          check.ok || { ok: false, detail: check.counts ? `${check.counts.present} of ${check.counts.expected}` : "" },
      })),
    ],
  });
}
