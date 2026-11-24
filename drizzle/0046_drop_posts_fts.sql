-- contract: drops what nothing reads.
--   - posts_fts and its three triggers: search reads search_identity and search_prose; no code touches posts_fts since #1039.
--   - media_refs_key_idx: a prefix of the table's primary key, so the key already serves it.
-- Hand-written. Hand-run on production before the merge, since a deploy refuses a drop:
--   wrangler d1 migrations apply dustinedwards --remote
DROP TRIGGER IF EXISTS posts_fts_ai;
DROP TRIGGER IF EXISTS posts_fts_ad;
DROP TRIGGER IF EXISTS posts_fts_au;
DROP TABLE IF EXISTS posts_fts;
DROP INDEX IF EXISTS media_refs_key_idx;
