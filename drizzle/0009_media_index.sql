-- The media table becomes the INDEX, not an annotation sidecar.
--
-- Ruling: decisions.md, 2026-08-02, "The media INDEX moves to D1. R2 stays the
-- truth." Governing doc: media-module-architecture.md. 0007 created `media` as
-- pure annotation and said so in its header: "Rows are NOT authoritative for
-- existence." That is exactly what changes here. Existence is now indexed, and
-- `check:media` reconciles the index against R2 and against `public/` in both
-- directions.
--
-- 0007 IS NOT EDITED. It is applied on both databases and an applied migration
-- is never rewritten, so this is ALTER plus one new table.
--
-- CONFLICT RULE, from the ruling, stated here because this schema is what makes
-- it enforceable: R2 WINS. A row with no object is deleted; an object with no
-- row is backfilled. Never the reverse. Nothing in this table is ever allowed to
-- be the reason an object is believed to exist.

-- `r2_key` becomes `key`, because the column no longer holds only R2 keys: a
-- static asset is indexed in place under its PUBLIC PATH, and it has no R2 key
-- to give. Renamed rather than added-and-copied so the primary key, and every
-- row already keyed by it, survive untouched.
ALTER TABLE media RENAME COLUMN r2_key TO key;

-- `uploaded` becomes `uploaded_at`, matching the ratified schema and the naming
-- every other timestamp column in this database already uses.
ALTER TABLE media RENAME COLUMN uploaded TO uploaded_at;

-- WHERE the bytes live, which is a property of the asset's LIFECYCLE and not of
-- its type. 'r2' is an editor upload, 'r2-derived' is something a command can
-- regenerate (OG cards), 'static' is a build-time asset indexed in place under
-- public/. The discriminator is whether anything ever writes it after deploy: an
-- asset needs R2 exactly when it needs a runtime write path.
ALTER TABLE media ADD COLUMN storage TEXT NOT NULL DEFAULT 'r2';

-- WHAT the asset is. 'image' and 'document' are the ratified pair; 'other'
-- exists because walking public/ indexes every file, and site.webmanifest is
-- honestly neither. Inventing a kind for it would have been a lie, and skipping
-- it would have made the walk fail open on any file type nobody had thought of.
ALTER TABLE media ADD COLUMN kind TEXT NOT NULL DEFAULT 'image';

ALTER TABLE media ADD COLUMN mime TEXT;
ALTER TABLE media ADD COLUMN bytes INTEGER;

-- The human-readable name, which is where readability went when keys became
-- content-addressed. `sha256(bytes)` truncated plus an extension is an ADDRESS;
-- it is not meant to be read, and the filename the author uploaded is not
-- derivable from it. This column is the only place that name survives.
ALTER TABLE media ADD COLUMN original_name TEXT;

-- AUTHORED, and the whole reason a rebuild is not a truncate-and-reinsert.
-- Everything else in this table is recomputable from the bytes; these are
-- recoverable from nothing, which makes them the only media data in the system
-- that can be permanently lost. `alt` and `caption` already exist from 0007 and
-- are equally authored.
ALTER TABLE media ADD COLUMN focal_x REAL;
ALTER TABLE media ADD COLUMN focal_y REAL;

-- LQIP, inline as a base64 data URI. Chosen over ThumbHash and BlurHash because
-- both need client-side JavaScript to decode and this site's zero-JS rule
-- forbids that. Roughly 300 bytes against ThumbHash's 25; the extra bytes buy
-- the rule.
ALTER TABLE media ADD COLUMN placeholder TEXT;

-- `created_at` and `updated_at` from 0007 are deliberately KEPT rather than
-- dropped to match the ratified schema exactly. They cost nothing, `updated_at`
-- is genuinely useful for spotting a stale rebuild, and dropping a NOT NULL
-- column with a default off a live table buys nothing but risk.

-- The two rows 0007 left behind are DELETED, not migrated.
--
-- Both are throwaway verification PNGs uploaded on 2026-08-01 (64x40 and 48x32)
-- and both are keyed under the superseded `posts/<year>/<slug>-<8hex>` scheme
-- that content addressing replaces. Migrating them would mean rewriting the
-- object keys in R2 to match, which is real work to preserve two test images
-- nothing cites. Their R2 objects are removed in the same operation, because
-- deleting the rows alone would leave two objects with no rows and the next
-- rebuild would faithfully put them straight back: R2 wins, so R2 is where a
-- deletion has to happen.
DELETE FROM media;

CREATE INDEX IF NOT EXISTS media_storage_idx ON media (storage);
CREATE INDEX IF NOT EXISTS media_kind_idx ON media (kind);

-- Usage, written by the PIPELINE at render time rather than discovered by a
-- scan. That is the fail-open this design closes: a resolver that is never
-- registered returns no citations, `resolveCitations` reports complete, and the
-- library shows "Unused" beside a working Delete button. Absence is not failure.
-- Anything that goes through the pipeline is indexed by construction, and
-- anything that does not is an enumerable gap rather than a silent one.
--
-- This table is created here and POPULATED IN PHASE 3. An empty table is honest
-- in the meantime: it says nothing has been indexed yet, where a missing table
-- would make the question unaskable.
--
-- No foreign key to media(key). A ref may legitimately name a key whose object
-- has not been indexed yet, and the ruling forbids the index being the reason
-- something is believed to exist. Reconciliation is check:media's job, not the
-- schema's.
CREATE TABLE IF NOT EXISTS media_refs (
  media_key   TEXT NOT NULL,
  -- 'post' today. The column exists so an album or a portfolio type can be
  -- added without a migration, which is the same seam the resolver has.
  source_type TEXT NOT NULL,
  -- The slug, for a post.
  source_id   TEXT NOT NULL,
  -- markdown-image | figure-directive | frontmatter-cover | link | html | other
  form        TEXT NOT NULL,
  -- Line number, so a refusal can name exactly where the citation is.
  detail      TEXT,
  -- One citation is one (key, source, form, place). The same image cited twice
  -- in one post at two different lines is two refs, which is what makes a
  -- refcount correct once keys are content-addressed and blobs are shared.
  PRIMARY KEY (media_key, source_type, source_id, form, detail)
);

CREATE INDEX IF NOT EXISTS media_refs_key_idx ON media_refs (media_key);
CREATE INDEX IF NOT EXISTS media_refs_source_idx ON media_refs (source_type, source_id);
