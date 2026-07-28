-- Discovery and parity fields for the blog.
--
-- Additive only. Nothing is dropped and no table is rebuilt, so posts_fts and
-- its three per-row triggers are untouched.
--
-- related and further_reading are JSON arrays rather than relations. Both are
-- derived from the generated artifact and are only ever read whole, for one
-- post, at render time. A join table would buy nothing and would add two more
-- things the editor's save path has to keep in step.

ALTER TABLE posts ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN series TEXT;
ALTER TABLE posts ADD COLUMN part INTEGER;
ALTER TABLE posts ADD COLUMN further_reading TEXT;
ALTER TABLE posts ADD COLUMN og_title TEXT;
ALTER TABLE posts ADD COLUMN og_description TEXT;
ALTER TABLE posts ADD COLUMN related TEXT;

-- Drives the featured slot and the series index without scanning.
CREATE INDEX posts_featured_idx ON posts (featured, publish_at);
CREATE INDEX posts_series_idx ON posts (series, part);
