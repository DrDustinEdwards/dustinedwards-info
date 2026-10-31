-- site-runtime's cron record (./cron, runJobs): one row per scheduled job, its last start, success and failure, so a
-- job that fails or stops is seen. Written only by runJobs (workers/app.ts scheduled()); this is its CRON_SQL as
-- written. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table, EMPTY. No existing table, column or row is touched.
CREATE TABLE IF NOT EXISTS cron_runs (
  name TEXT PRIMARY KEY NOT NULL,
  every_minutes INTEGER NOT NULL,
  first_started_at INTEGER,
  last_started_at INTEGER,
  last_ok_at INTEGER,
  last_failed_at INTEGER,
  last_error TEXT
);
