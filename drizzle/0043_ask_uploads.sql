-- The Ask upload ledger: per AI Search item key, the sha-256 of the body last uploaded under it, so sync_ask
-- uploads only what changed (askUploadsNeeded in app/lib/search/ask-twins.mjs). AI Search reports no usable
-- checksum, and re-uploading all of the corpus on every deploy drew "You are being rate limited" (2026-11-11).
-- Derived: a lost row costs one re-upload of that item, never data. Hand-written. Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table, EMPTY. No existing table, column or row is touched.
CREATE TABLE IF NOT EXISTS ask_uploads (
  key TEXT PRIMARY KEY NOT NULL,
  body_sha256 TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
