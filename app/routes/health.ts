/**
 * /health: site-runtime's healthResponse, what the outside reads: the UptimeRobot monitor, Capsid's watcher and the
 * family's ops audit. 503 only when D1 does not
 * answer. Warnings, never a 503: the newest complete dump older than 26 hours, a binding that does not answer, a cron
 * job that failed or stopped, and every drift check /api/health runs (the site is up while one drifts). /api/health
 * stays the repair instrument the watchdog, ship and the admin MCP read. `sha` is the commit ship deployed
 * (DEPLOY_SHA); a hand deploy has none. Same limiter and budget as /api/health, because the drift checks cost.
 */

import { backupHealth } from "@dustinedwards/d1-dump";
import { cronCheck } from "@dustinedwards/site-runtime/cron";
import {
  aiCheck,
  durableObjectCheck,
  healthResponse,
  imagesCheck,
  kvCheck,
  queueCheck,
  r2Check,
} from "@dustinedwards/site-runtime/health";
import { logEvent } from "@dustinedwards/site-runtime/log";

import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import { limitHit } from "~/lib/rate-limit.mjs";
import { HEALTH_CHECK_NAMES, runHealthChecks } from "~/lib/health/checks.server";
import { CHECK_TIMEOUT_MS } from "~/lib/health/verdicts.mjs";
import { CRON_JOBS } from "~/lib/cron-jobs.mjs";

import type { Route } from "./+types/health";

// The same three headers healthResponse sends, so a refusal is no more cacheable or indexable than an answer.
const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/health+json; charset=utf-8",
  "X-Robots-Tag": "noindex",
};

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

  /* The drift checks run once, started here and not awaited, so each named check below waits on the run inside
     healthResponse's checkTimeoutMs, beside the binding checks: a slow run holds /health no longer than any other
     check. A detail carries only the two counts, as on /api/health. */
  const drift = runHealthChecks(env);
  drift.catch(() => {}); // Each check's run reports the rejection; this keeps an unwaited one from being unhandled.
  /* LEVELS (area 8, H3). Only `db` (the ping) is fail: without D1 no page renders, so that is the site down. Every
     binding below is warn, because the site still serves its pages without it: MEDIA and IMAGES fall back to the
     original or a missing figure, OG to no card, APP_KV to an uncached read, MEDIA_BACKUP is the mirror, AI only
     serves an editor's suggestions, BROWSER only the CV PDF after a save, WEBMENTION_VERIFY only new mentions, and
     ASK_BUDGET is the limiter this route already called above (a limiter that does not answer is the 503 refusal
     there, not a check here). LEFT OUT: AI_SEARCH, because Ask is optional and classic search never waits on it,
     and the instance has no read that is not a billed query; the queue consumers and the dead-letter queues,
     because a consumer is not a binding this Worker holds. */
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    backup: () => backupHealth(env.BACKUPS),
    sha: (env as { DEPLOY_SHA?: string }).DEPLOY_SHA,
    checkTimeoutMs: CHECK_TIMEOUT_MS,
    checks: [
      { ...r2Check("media", env.MEDIA), level: "warn" },
      { ...r2Check("og", env.OG), level: "warn" },
      { ...kvCheck("kv", env.APP_KV), level: "warn" },
      { ...r2Check("media-backup", env.MEDIA_BACKUP), level: "warn" },
      imagesCheck("images", env.IMAGES),
      aiCheck("ai", env.AI),
      // No helper for Browser Rendering, and a probe would spend browser minutes: the binding is there or not.
      { name: "browser", level: "warn", run: async () => typeof env.BROWSER?.fetch === "function" || { ok: false, detail: "binding missing" } },
      queueCheck("webmention-queue", env.WEBMENTION_VERIFY),
      durableObjectCheck("ask-budget", env.ASK_BUDGET),
      cronCheck(env.DB, { jobs: [...CRON_JOBS] }),
      ...HEALTH_CHECK_NAMES.map((name) => ({
        name,
        level: "warn" as const,
        run: async () => {
          const check = (await drift).checks.find((c) => c.name === name);
          if (!check) return { ok: false, detail: "not run" };
          return check.ok || { ok: false, detail: check.counts ? `${check.counts.present} of ${check.counts.expected}` : "" };
        },
      })),
    ],
  });
}
