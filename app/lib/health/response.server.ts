/**
 * The site's health answer, site-runtime's healthResponse: /health serves it (behind its rate limit) and the
 * health-snapshot cron job (workers/app.ts) stores its verdict for the colophon. 503 only when D1 does not answer.
 * Warnings, never a 503: the newest complete dump older than 26 hours, a binding that does not answer, a cron job
 * that failed or stopped, and every drift check (the site is up while one drifts). `sha` is the commit ship deployed
 * (DEPLOY_SHA); a hand deploy has none.
 */

import { cronCheck } from "@dustinedwards/site-runtime/cron";
import {
  durableObjectCheck,
  healthResponse,
  imagesCheck,
  kvCheck,
  queueCheck,
  r2Check,
} from "@dustinedwards/site-runtime/health";

import { HEALTH_CHECK_NAMES, runHealthChecks } from "~/lib/health/checks.server";
import { CHECK_TIMEOUT_MS } from "~/lib/health/verdicts.mjs";
import { CRON_JOBS } from "~/lib/cron-jobs.mjs";
import { backupStatus } from "~/lib/backup/d1-backup.server";

export function siteHealthResponse(env: Env): Promise<Response> {
  /* The drift checks run once, started here and not awaited, so each named check below waits on the run inside
     healthResponse's checkTimeoutMs, beside the binding checks: a slow run holds /health no longer than any other
     check. A detail carries only "present of expected" (rows.mjs reads it back), because this is public; the full
     detail (the missing keys) goes to Workers Logs under alert=health-check-failed. */
  const drift = runHealthChecks(env);
  drift.then(
    (run) => {
      if (run.failed.length === 0) return;
      console.error(
        JSON.stringify({
          alert: "health-check-failed",
          failed: run.failed.map((c) => c.name),
          detail: run.failed.map((c) => c.detail),
        }),
      );
    },
    () => {}, // Each check's run reports the rejection; this keeps an unwaited one from being unhandled.
  );
  /* LEVELS (area 8, H3). Only `db` (the ping) is fail: without D1 no page renders, so that is the site down. Every
     binding below is warn, because the site still serves its pages without it: MEDIA and IMAGES fall back to the
     original or a missing figure, OG to no card, APP_KV to an uncached read, MEDIA_REVISIONS only a replace or a revert, AI only
     serves an editor's suggestions, BROWSER only the CV PDF after a save, WEBMENTION_VERIFY only new mentions, and
     ASK_BUDGET is the limiter this route already called above (a limiter that does not answer is the 503 refusal
     there, not a check here). LEFT OUT: AI_SEARCH, because Ask is optional and classic search never waits on it,
     and the instance has no read that is not a billed query; the queue consumers and the dead-letter queues,
     because a consumer is not a binding this Worker holds. */
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    // The dump with the media and revisions files backups (d1-backup.server.ts), any one's warning warns. Each is
    // nightly and the warning threshold 26 hours; healthResponse keeps the read an hour in the Cache API (site-runtime 0.75.0).
    backup: () => backupStatus(env),
    sha: (env as { DEPLOY_SHA?: string }).DEPLOY_SHA,
    checkTimeoutMs: CHECK_TIMEOUT_MS,
    checks: [
      { ...r2Check("media", env.MEDIA), level: "warn" },
      { ...r2Check("og", env.OG), level: "warn" },
      { ...kvCheck("kv", env.APP_KV), level: "warn" },
      { ...r2Check("media-revisions", env.MEDIA_REVISIONS), level: "warn" },
      imagesCheck("images", env.IMAGES),
      // No helper for Browser Rendering, and a probe would spend browser minutes: the binding is there or not.
      {
        name: "browser",
        level: "warn",
        run: async () =>
          typeof env.BROWSER?.fetch === "function" || { ok: false, detail: "binding missing" },
      },
      queueCheck("webmention-verify", env.WEBMENTION_VERIFY),
      durableObjectCheck("ask-budget", env.ASK_BUDGET),
      // The deploy's time holds a job back until its first window since the deploy has passed: a job added
      // after its hour today (purge-zero-results, check-publications) has not been due yet.
      cronCheck(env.DB, {
        jobs: [...CRON_JOBS],
        deployedAt: env.CF_VERSION_METADATA?.timestamp
          ? new Date(env.CF_VERSION_METADATA.timestamp)
          : undefined,
      }),
      ...HEALTH_CHECK_NAMES.map((name) => ({
        name,
        level: "warn" as const,
        run: async () => {
          const check = (await drift).checks.find((c) => c.name === name);
          if (!check) return { ok: false, detail: "not run" };
          return (
            check.ok || {
              ok: false,
              detail: check.counts ? `${check.counts.present} of ${check.counts.expected}` : "",
            }
          );
        },
      })),
    ],
  });
}
