// Every job the site Worker's one cron runs, with its work and the firing it is due on. The scheduled handler
// (workers/app.ts) runs the ones due at that minute; the operator API's run_job (site-runtime ./cron runJobTool) runs
// any of them now, through the same runJobs path, so a run by hand lands in cron_runs exactly as the cron's would.
// Each job's interval and timeout are CRON_JOBS (app/lib/cron-jobs.mjs), the list /health checks.
import type { CronJob } from "@dustinedwards/site-runtime/cron";
import { pruneNotFound } from "@dustinedwards/site-runtime/not-found";

import { cronJob, HEALTH_SNAPSHOT_EVERY_MINUTES } from "~/lib/cron-jobs.mjs";

/** The nightly firing at 05:00 UTC: the D1 dump, the media files backup and the 404 prune. */
const isNightly = (at: Date) => at.getUTCHours() === 5 && at.getUTCMinutes() === 0;

/** The one firing a day at `hour`:00 UTC, for a daily job of its own. */
const isDailyAt = (at: Date, hour: number) => at.getUTCHours() === hour && at.getUTCMinutes() === 0;

export type SiteJob = CronJob & { due: (at: Date) => boolean };

/**
 * The jobs, in run order. `at` is the firing's time (the cron's scheduledTime, or now for a run by hand). The two
 * backups are marked backup, so Capsid Admin's back up now runs them. Imported lazily: the gateway never loads the save
 * path, and neither does the test entry.
 */
export function siteJobs(env: Env, ctx: ExecutionContext, at: Date): SiteJob[] {
  return [
    {
      ...cronJob("carrel-schedules"),
      due: () => true,
      run: async () => {
        const { runCarrelSchedules } = await import("~/lib/carrel/site-api.server");
        const run = await runCarrelSchedules(env, ctx, at);
        if (run.failed > 0)
          throw new Error(`${run.failed} schedule(s) failed; the next firing retries them`);
        return run;
      },
    },
    {
      ...cronJob("backup"),
      backup: true,
      due: isNightly,
      run: async () => (await import("~/lib/backup/d1-backup.server")).backupD1(env),
    },
    {
      ...cronJob("media-backup"),
      backup: true,
      due: isNightly,
      run: async () => ({
        files: await (await import("~/lib/backup/d1-backup.server")).backupMedia(env),
      }),
    },
    // The 404 counts keep 90 days, as the privacy page says.
    { ...cronJob("prune-404"), due: isNightly, run: () => pruneNotFound(env.DB, { days: 90 }) },
    // The colophon's health verdict, every fifteen minutes (app/lib/health/snapshot-store.server.ts).
    {
      ...cronJob("health-snapshot"),
      due: (t) => t.getUTCMinutes() % HEALTH_SNAPSHOT_EVERY_MINUTES === 0,
      run: async () =>
        (await import("~/lib/health/snapshot-store.server")).storeHealthSnapshot(env, at),
    },
    // Zero-result queries past their retention cutoff, the cutoff the admin Tools page names.
    {
      ...cronJob("purge-zero-results"),
      due: (t) => isDailyAt(t, 4),
      run: async () => ({
        purged: await (await import("~/lib/search/zero-result.server")).purgeZeroResults(env, at),
      }),
    },
    // New DOIs on ORCID or Crossref, each mailed once (app/lib/publications/notify.server.ts).
    {
      ...cronJob("check-publications"),
      due: (t) => isDailyAt(t, 6),
      run: async () =>
        (await import("~/lib/publications/notify.server")).checkPublicationsDaily(env),
    },
  ];
}
