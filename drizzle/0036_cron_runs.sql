-- The cron record site-runtime ./cron keeps (CRON_SQL, v0.42.0): each scheduled job's last start, success and
-- failure, which /health's cron check reads. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No row is rewritten.

CREATE TABLE IF NOT EXISTS cron_runs (
  name TEXT PRIMARY KEY NOT NULL,
  every_minutes INTEGER NOT NULL,
  first_started_at INTEGER,
  last_started_at INTEGER,
  last_ok_at INTEGER,
  last_failed_at INTEGER,
  last_error TEXT
);
