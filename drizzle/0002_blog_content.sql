-- Blog content model for dustinedwards.info
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards
--
-- Additive only. Nothing is dropped and no table is rebuilt, so the posts_fts
-- virtual table and its three per-row triggers are untouched by this migration.
--
-- `posts.category` is deliberately left in place. New reads go through the tags
-- relation below; the old column is retired in a later migration once nothing
-- reads it.
--
-- `posts.publish_at` already exists from 0001_init.sql and is not re-added.

-- Tags ----------------------------------------------------------------------

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Covers the tag-filtered index read, which starts from a tag and finds posts.
CREATE INDEX post_tags_tag_idx ON post_tags (tag_id);

-- Post columns the markdown generator writes ---------------------------------

ALTER TABLE posts ADD COLUMN description TEXT;
ALTER TABLE posts ADD COLUMN cover_image TEXT;
ALTER TABLE posts ADD COLUMN cover_alt TEXT;
ALTER TABLE posts ADD COLUMN reading_time_minutes INTEGER;
ALTER TABLE posts ADD COLUMN html TEXT;
ALTER TABLE posts ADD COLUMN source_path TEXT;

-- One content file maps to exactly one row. SQLite permits repeated NULLs in a
-- unique index, so rows with no backing file (pages) are unaffected.
CREATE UNIQUE INDEX posts_source_path_idx ON posts (source_path);
