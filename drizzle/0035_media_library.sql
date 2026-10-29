-- The media library's v0.13.0 ideas (site-api): a content hash for duplicates, credit and license, the date a
-- picture was taken (from its embedded metadata), a byte history for transforms and reverts, and a change log
-- that a screen polls. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: six columns with defaults or NULL, two new tables, one index and three triggers. No row is
-- rewritten. Existing rows start with no hash (findByHash falls back to the digest their content-addressed key
-- already carries), no credit, no history (their current bytes are their only revision) and no change entry.

-- The SHA-256 of the object's current bytes, lower case hex. NULL for a row written before this migration.
ALTER TABLE media ADD COLUMN sha256 TEXT;
-- Who made it and the terms it is used under: free text, '' for none.
ALTER TABLE media ADD COLUMN credit TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN license TEXT NOT NULL DEFAULT '';
-- Where it came from (an import's address, or one an editor typed), and the day its license runs out (YYYY-MM-DD).
ALTER TABLE media ADD COLUMN source_url TEXT;
ALTER TABLE media ADD COLUMN license_expires TEXT;
-- When the picture was taken, as its embedded metadata says.
ALTER TABLE media ADD COLUMN taken_at TEXT;

CREATE INDEX media_sha256_idx ON media (sha256);

-- One row per set of bytes a file has had. The newest row for a key is its current bytes, which live in MEDIA;
-- every earlier row names the copy kept in MEDIA_BACKUP (`backup_key`), which nothing deletes (check:destructive).
CREATE TABLE media_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL,
  at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  -- upload | import | replace | transform | resize | revert
  reason TEXT NOT NULL,
  sha256 TEXT,
  backup_key TEXT
);
CREATE INDEX media_revisions_key_idx ON media_revisions (media_key, id);

-- Every change to an uploaded file's row, in order: what `changedSince` answers from. Triggers rather than a
-- write in each writer, so the queue's derived upserts, the rebuild and a delete are logged as surely as an edit.
-- Static rows are left out: their keys are repository paths, never media ids.
CREATE TABLE media_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX media_changes_key_idx ON media_changes (media_key, seq);

CREATE TRIGGER media_changes_ai AFTER INSERT ON media WHEN NEW.storage <> 'static' BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_au AFTER UPDATE ON media WHEN NEW.storage <> 'static' BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_ad AFTER DELETE ON media WHEN OLD.storage <> 'static' BEGIN
  INSERT INTO media_changes (media_key) VALUES (OLD.key);
END;
