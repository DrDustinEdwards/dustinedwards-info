-- Three facts about posts that Carrel's v0.17.0 contract needs and a post's file does not hold
-- (app/lib/carrel/post-state.server.ts):
--   content_trash        a post in Carrel's trash, since when and by which change; site-api's cron deletes it for good
--                        30 days later. A trashed post's file is a draft, so the build never publishes it.
--   post_redirects       the old slug of a renamed post that was ever public, answered with a 301 to its new address
--                        (app/routes/blog.$slug.tsx). A second rename repoints the first.
--   scheduled_publishes  a post scheduled before it was ever live: it goes live by its publish_at with no write, so
--                        the cron lists it as due once its time comes and the publish hooks (IndexNow, the cache
--                        purge, webmentions) hear it go live once.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: three new tables and one index. No existing table, column or row is touched; the one INSERT copies the
-- posts already scheduled into scheduled_publishes, so the cron hears those go live too.
CREATE TABLE IF NOT EXISTS content_trash (
  content_id TEXT PRIMARY KEY,
  trashed_at TEXT NOT NULL,
  change_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_redirects (
  from_slug TEXT PRIMARY KEY,
  to_slug TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS scheduled_publishes (
  content_id TEXT PRIMARY KEY,
  publish_at TEXT NOT NULL,
  change_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scheduled_publishes_due ON scheduled_publishes (publish_at);
INSERT OR IGNORE INTO scheduled_publishes (content_id, publish_at, change_id)
  SELECT slug, strftime('%Y-%m-%dT%H:%M:%S.000Z', publish_at, 'unixepoch'), 'scheduled-before-0038'
  FROM posts WHERE kind = 'post' AND status = 'published' AND publish_at > unixepoch();
