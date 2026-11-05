// The site Worker's scheduled jobs, by name: how often each should succeed and how long one may run. One list, read
// by the scheduled handler (workers/app.ts, which adds each job's `run`) and by /health's cron check, so a job the
// check expects is a job the trigger runs. The one cron key is "* * * * *" (wrangler.jsonc.example); the backup
// and the media backup run on the 05:00 UTC firing of it only.
//
// Timeouts (site-runtime runJobs, area 8 C3): carrel-schedules gets two minutes; the dump gets ten, its last runs took
// seconds and a dump that has not finished in ten minutes is hung, not slow. The media backup gets ten too: each of its
// two backupFiles passes stops itself at five minutes (d1-dump's timeBudgetMs) and the next night goes on from there. A job past its timeout is recorded failed and the next one starts.

export const CRON_JOBS = Object.freeze([
  Object.freeze({ name: "carrel-schedules", everyMinutes: 1, timeoutMs: 2 * 60_000 }),
  Object.freeze({ name: "backup", everyMinutes: 1440, timeoutMs: 10 * 60_000 }),
  Object.freeze({ name: "media-backup", everyMinutes: 1440, timeoutMs: 10 * 60_000 }),
]);

/** @param {string} name */
export function cronJob(name) {
  const job = CRON_JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`no cron job named ${name}`);
  return job;
}
