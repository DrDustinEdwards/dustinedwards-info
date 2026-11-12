-- contract: rebuilds `media` as site-api's standard library tables and moves the site's own files to `site_assets`.
--
-- The media library moves onto site-api's d1MediaStore over the network's standard tables (MEDIA_LIBRARY_SQL,
-- site-api src/media-store.ts), as Foxing, Foxhound and germomics did. The old `media` table was two indexes in one:
-- the library's uploads (storage 'r2', in MEDIA) and an index of the site's own files, the paths in public/ and the
-- Worker's generated objects in OG (storage 'static' and 'r2-derived'). The uploads go to the standard `media`,
-- `media_revisions` and `media_changes`; the site's own files go to `site_assets`, which only the rebuild and the R2
-- events write. Hand-written (drizzle-kit is intentionally not used). Hand-run on production before the merge:
--   wrangler d1 execute dustinedwards --remote --file drizzle/0044_shared_media_store.sql
--
-- Conversions: tags from the delimiter-wrapped ",a,b," to a JSON array (normalizeTags only ever stored [a-z0-9-]);
-- focal_x/focal_y to focus "XxY"; trashed_at from D1's "YYYY-MM-DD HH:MM:SS" to ISO 8601; an upload time the row
-- never had takes the time it was indexed; backup_key becomes copy_key. A row with no hash keeps '' (production's
-- three such rows are given their hash before this runs). The change log keeps its sequence numbers for library
-- keys, and its high-water mark, so a cursor Carrel holds still means the same place; the copied rows then log once
-- more, after it. The site's files keep only what the index derives: their authored columns were never read.

DROP TRIGGER media_changes_ai;
DROP TRIGGER media_changes_au;
DROP TRIGGER media_changes_ad;
ALTER TABLE media RENAME TO media_old;
ALTER TABLE media_revisions RENAME TO media_revisions_old;
ALTER TABLE media_changes RENAME TO media_changes_old;
DROP INDEX media_uploaded_idx;
DROP INDEX media_sha256_idx;
DROP INDEX media_storage_idx;
DROP INDEX media_kind_idx;
DROP INDEX media_role_idx;
DROP INDEX media_trashed_idx;
DROP INDEX media_revisions_key_idx;
DROP INDEX media_changes_key_idx;

CREATE TABLE media (
  key TEXT PRIMARY KEY NOT NULL,
  filename TEXT,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  sha256 TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  focus TEXT,
  credit TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  license_expires TEXT,
  taken_at TEXT,
  uploaded_at TEXT NOT NULL,
  trashed_at TEXT,
  rev INTEGER NOT NULL DEFAULT 0,
  placeholder TEXT,
  color TEXT
);
CREATE INDEX media_sha256 ON media (sha256);
CREATE TABLE media_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL,
  at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  reason TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  copy_key TEXT
);
CREATE INDEX media_revisions_key ON media_revisions (media_key, id);
CREATE TABLE media_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL
);
CREATE TRIGGER media_changes_insert AFTER INSERT ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_update AFTER UPDATE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_delete AFTER DELETE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (OLD.key);
END;

-- The library's entries, by their own numbers; the OG bucket's keys (og/, derived/) were never the library's.
INSERT INTO media_changes (seq, media_key)
SELECT seq, media_key FROM media_changes_old
WHERE media_key NOT LIKE 'og/%' AND media_key NOT LIKE 'derived/%'
ORDER BY seq;
-- The high-water mark: AUTOINCREMENT keeps the largest number it has seen after the row is gone, so the next
-- change is numbered past every cursor the old log handed out.
INSERT INTO media_changes (seq, media_key)
SELECT seq, '' FROM (SELECT max(seq) AS seq FROM media_changes_old)
WHERE seq IS NOT NULL AND seq NOT IN (SELECT seq FROM media_changes);
DELETE FROM media_changes WHERE media_key = '';

INSERT INTO media_revisions (id, media_key, at, bytes, width, height, reason, sha256, copy_key)
SELECT id, media_key, at, bytes, width, height, reason, coalesce(sha256, ''), backup_key
FROM media_revisions_old ORDER BY id;

INSERT INTO media (key, filename, content_type, bytes, width, height, sha256, alt, caption, tags, focus, credit,
  license, source_url, license_expires, taken_at, uploaded_at, trashed_at, rev, placeholder, color)
SELECT key, original_name, coalesce(mime, 'application/octet-stream'), coalesce(bytes, 0), width, height,
  coalesce(sha256, ''), alt, caption,
  CASE WHEN tags = '' THEN '[]' ELSE '["' || replace(trim(tags, ','), ',', '","') || '"]' END,
  CASE WHEN focal_x IS NULL OR focal_y IS NULL THEN NULL ELSE
    rtrim(rtrim(CAST(round(min(1, max(0, focal_x)), 3) AS TEXT), '0'), '.') || 'x' ||
    rtrim(rtrim(CAST(round(min(1, max(0, focal_y)), 3) AS TEXT), '0'), '.') END,
  credit, license, source_url, license_expires, taken_at,
  coalesce(uploaded_at, strftime('%Y-%m-%dT%H:%M:%S.000Z', created_at)),
  CASE WHEN trashed_at IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%S.000Z', trashed_at) END,
  rev, placeholder, NULL
FROM media_old WHERE storage = 'r2' ORDER BY uploaded_at, key;

-- The site's own files: a path in public/ (storage 'static') or a generated object in OG ('r2-derived'), each as the
-- rebuild and the R2 events derive it. Never the library's: nothing here is uploaded, authored or served from MEDIA.
CREATE TABLE site_assets (
  key TEXT PRIMARY KEY NOT NULL,
  storage TEXT NOT NULL,
  kind TEXT NOT NULL,
  role TEXT NOT NULL,
  mime TEXT,
  bytes INTEGER,
  width INTEGER,
  height INTEGER,
  uploaded_at TEXT
);
INSERT INTO site_assets (key, storage, kind, role, mime, bytes, width, height, uploaded_at)
SELECT key, storage, kind, role, mime, bytes, width, height, uploaded_at
FROM media_old WHERE storage <> 'r2' ORDER BY key;

DROP TABLE media_old;
DROP TABLE media_revisions_old;
DROP TABLE media_changes_old;
