// The site Worker's scheduled jobs, by name: how often each should succeed and how long one may run. One list,
// read by the scheduled handler (workers/app.ts) and by /health's cron check, so a job the check expects is a
// job the trigger runs. The one cron key is "* * * * *"; the backup jobs run on its 05:00 UTC firing only.
// A job past its timeout is recorded failed and the next one starts. Timeouts are sized to the work: the dump
// gets ten minutes (a dump unfinished by then is hung, not slow); each backupFiles pass stops itself at five
// (d1-dump's timeBudgetMs) and the next night goes on; one-DELETE and count jobs get one minute.

/** How often the colophon's health verdict is taken; site-runtime ./health-snapshot derives its stale bound from it. */
export const HEALTH_SNAPSHOT_EVERY_MINUTES = 15;

export const CRON_JOBS = Object.freeze([
  Object.freeze({ name: "carrel-schedules", everyMinutes: 1, timeoutMs: 2 * 60_000 }),
  Object.freeze({ name: "ask-index", everyMinutes: 1, timeoutMs: 60_000 }),
  Object.freeze({ name: "backup", everyMinutes: 1440, timeoutMs: 10 * 60_000 }),
  Object.freeze({ name: "media-backup", everyMinutes: 1440, timeoutMs: 10 * 60_000 }),
  Object.freeze({ name: "prune-404", everyMinutes: 1440, timeoutMs: 60_000 }),
  Object.freeze({
    name: "health-snapshot",
    everyMinutes: HEALTH_SNAPSHOT_EVERY_MINUTES,
    timeoutMs: 2 * 60_000,
  }),
  Object.freeze({ name: "purge-zero-results", everyMinutes: 1440, timeoutMs: 60_000 }),
  Object.freeze({ name: "check-publications", everyMinutes: 1440, timeoutMs: 5 * 60_000 }),
  Object.freeze({ name: "page-dates", everyMinutes: 1440, timeoutMs: 5 * 60_000 }),
]);

/** @param {string} name */
export function cronJob(name) {
  const job = CRON_JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`no cron job named ${name}`);
  return job;
}
