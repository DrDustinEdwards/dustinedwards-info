-- site-api's store (v0.21.0): the media file each upload's duplicates key became (media_uploads), so a picture the
-- adapter converted or shrank is still found when it is sent again. Written and read only through
-- @dustinedwards/site-api/store's d1SiteApiStore; this is its SITE_API_STORE_SQL_V0_21 as written. Hand-written.
-- Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table, EMPTY. No existing table, column or row is touched.
CREATE TABLE IF NOT EXISTS media_uploads (
  sha256 TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  at TEXT NOT NULL
);
