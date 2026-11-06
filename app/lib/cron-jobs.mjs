// The site Worker's scheduled jobs, by name: how often each should succeed and how long one may run. One list, read
// by the scheduled handler (workers/app.ts, which adds each job's `run`) and by /health's cron check, so a job the
// check expects is a job the trigger runs. The one cron key is "* * * * *" (wrangler.jsonc.example); the backup
// and the media backup run on the 05:00 UTC firing of it only.
//
// Timeouts (site-runtime runJobs, area 8 C3): carrel-schedules gets two minutes; the dump gets ten, its last runs took
// seconds and a dump that has not finished in ten minutes is hung, not slow. The media backup gets ten too: each of its
// two backupFiles passes stops itself at five minutes (d1-dump's timeBudgetMs) and the next night goes on from there.
// prune-404 is one DELETE, so one minute. A job past its timeout is recorded failed and the next one starts.
//
// Three jobs came from the retired watchdog Worker (2026-11-06; Capsid's watcher now reads /health, repairs drift and
// runs the weekly citation refresh, as it does for every site): health-snapshot stores the colophon's health verdict
// every fifteen minutes (a health run takes about a second, so two minutes is hung); purge-zero-results removes
// expired zero-result queries at 04:00 UTC (one DELETE, one minute); check-publications reads ORCID and Crossref at
// 06:00 UTC and mails each new DOI once (two outside APIs, so five minutes).

/** How often the colophon's health verdict is taken; snapshot.mjs derives its stale bound from it. */
export const HEALTH_SNAPSHOT_EVERY_MINUTES = 15;

export const CRON_JOBS = Object.freeze([
  Object.freeze({ name: "carrel-schedules", everyMinutes: 1, timeoutMs: 2 * 60_000 }),
  Object.freeze({ name: "backup", everyMinutes: 1440, timeoutMs: 10 * 60_000 }),
  Object.freeze({ name: "media-backup", everyMinutes: 1440, timeoutMs: 10 * 60_000 }),
  Object.freeze({ name: "prune-404", everyMinutes: 1440, timeoutMs: 60_000 }),
  Object.freeze({ name: "health-snapshot", everyMinutes: HEALTH_SNAPSHOT_EVERY_MINUTES, timeoutMs: 2 * 60_000 }),
  Object.freeze({ name: "purge-zero-results", everyMinutes: 1440, timeoutMs: 60_000 }),
  Object.freeze({ name: "check-publications", everyMinutes: 1440, timeoutMs: 5 * 60_000 }),
]);

/** @param {string} name */
export function cronJob(name) {
  const job = CRON_JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`no cron job named ${name}`);
  return job;
}
