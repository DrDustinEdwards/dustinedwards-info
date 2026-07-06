-- Initial schema for dustinedwards.info
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards

-- Content -------------------------------------------------------------------

CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  kind       TEXT NOT NULL CHECK (kind IN ('page', 'post')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  excerpt    TEXT,
  status     TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  publish_at INTEGER,
  category   TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX posts_status_publish_idx ON posts (status, publish_at);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full text search over posts(title, body) ----------------------------------

CREATE VIRTUAL TABLE posts_fts USING fts5 (
  title,
  body,
  content = 'posts',
  content_rowid = 'id'
);

CREATE TRIGGER posts_fts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts (rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER posts_fts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts (posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;

CREATE TRIGGER posts_fts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts (posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO posts_fts (rowid, title, body) VALUES (new.id, new.title, new.body);
END;

-- Better Auth ---------------------------------------------------------------

CREATE TABLE user (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image         TEXT,
  createdAt     INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE session (
  id        TEXT PRIMARY KEY,
  expiresAt INTEGER NOT NULL,
  token     TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
  ipAddress TEXT,
  userAgent TEXT,
  userId    TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE account (
  id                     TEXT PRIMARY KEY,
  accountId              TEXT NOT NULL,
  providerId             TEXT NOT NULL,
  userId                 TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  accessToken            TEXT,
  refreshToken           TEXT,
  idToken                TEXT,
  accessTokenExpiresAt   INTEGER,
  refreshTokenExpiresAt  INTEGER,
  scope                  TEXT,
  password               TEXT,
  createdAt              INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt              INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed ----------------------------------------------------------------------

INSERT INTO settings (key, value) VALUES (
  'llms.txt',
  '# dustinedwards.info

Personal site of Dr. Dustin Edwards, Professor of Virology at Tarleton State University.

## About
Research and teaching in virology, with writing and lab notes published here.

## Contact
https://dustinedwards.info
'
);
