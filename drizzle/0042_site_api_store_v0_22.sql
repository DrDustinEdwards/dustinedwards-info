-- site-api's store (v0.22.0): gone_paths keeps the public path of each live post Carrel deleted or trashed, so the post's
-- old address answers 410 (app/routes/blog.$slug.tsx, goneResponse); hook_runs keeps each publish hook's run for
-- GET /hooks/recent. Written and read only through @dustinedwards/site-api/store's d1SiteApiStore; this is its
-- SITE_API_STORE_SQL_V0_22 as written. Hand-written. Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: two new tables, EMPTY, and two indexes. No existing table, column or row is touched.
CREATE TABLE IF NOT EXISTS gone_paths (
  path TEXT PRIMARY KEY,
  gone_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hook_runs (
  change_id TEXT NOT NULL,
  hook TEXT NOT NULL,
  ok INTEGER NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hook_runs_change ON hook_runs (change_id);
CREATE INDEX IF NOT EXISTS hook_runs_at ON hook_runs (at);
