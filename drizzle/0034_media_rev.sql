-- A revision counter on each media row, so a write can name the version it was loaded at and be refused,
-- in the same statement, when the row has moved since (site-api's media writes: alt, tags, trash, restore,
-- focal point, caption and replace). `updated_at` cannot do this: datetime('now') has one-second resolution,
-- so two writes in one second would share a version. Every editable-metadata write bumps it
-- (app/db/media.ts, writeMediaAtRev and upsertMediaRecord); the pipeline's derived upserts and the rebuild
-- leave it alone. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one column with a default, so every existing row starts at 0. No row is rewritten.
ALTER TABLE media ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
