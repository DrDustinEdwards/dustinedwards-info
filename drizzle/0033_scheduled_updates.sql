-- Scheduled updates to live posts (site-api v0.10.0, the `schedules` group). A live post carries at most one waiting
-- update: its own source and time. The live version stays served until then, and the site Worker's cron
-- (workers/app.ts scheduled(), every five minutes) puts the update live through savePost and drops the row.
-- The SQL is the package's SCHEDULED_UPDATES_SQL (@dustinedwards/site-api/schedules), unchanged. Hand-written
-- (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table and one index, EMPTY. No existing table, column or row is touched.
CREATE TABLE IF NOT EXISTS scheduled_updates (
  content_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  publish_at TEXT NOT NULL,
  change_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scheduled_updates_due ON scheduled_updates (publish_at);
