-- The site's own 404s, per missing path, referring host and UTC day (site-runtime ./not-found, NOT_FOUND_SQL), counted
-- by workers/app.ts and pruned to 90 days by the cron's prune-404 job. Only the path (never its query), the host of
-- the referring page and a daily count are kept: no address, cookie or identifier. The privacy page names it.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table and its unique index. No row is rewritten.

CREATE TABLE IF NOT EXISTS page_404_daily (
  id TEXT PRIMARY KEY NOT NULL,
  day INTEGER NOT NULL,
  path TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'page',
  hit_count INTEGER DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS page_404_daily_day_path_referrer_uq ON page_404_daily (day, path, referrer_host);
