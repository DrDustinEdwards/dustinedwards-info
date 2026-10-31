-- site-api's store (v0.17.0): safe retries by change id (site_api_writes), the publish hooks that failed and wait to
-- run again (hook_retries), Carrel's shareable preview links, kept as the SHA-256 of each token (preview_links), and
-- the webmentions each page last sent (webmention_targets). Written and read only through
-- @dustinedwards/site-api/store's d1SiteApiStore (app/lib/carrel/site-api.server.ts); this is its SITE_API_STORE_SQL as
-- written. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: four new tables and three indexes, EMPTY. No existing table, column or row is touched.
CREATE TABLE IF NOT EXISTS site_api_writes (
  change_id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status INTEGER,
  response TEXT,
  state TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS site_api_writes_at ON site_api_writes (at);
CREATE TABLE IF NOT EXISTS hook_retries (
  id TEXT PRIMARY KEY,
  hook TEXT NOT NULL,
  event TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  next_at TEXT NOT NULL,
  last_error TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hook_retries_due ON hook_retries (next_at);
CREATE TABLE IF NOT EXISTS preview_links (
  token_hash TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  change_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS preview_links_content ON preview_links (content_id, expires_at);
CREATE TABLE IF NOT EXISTS webmention_targets (
  source TEXT PRIMARY KEY,
  targets TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
