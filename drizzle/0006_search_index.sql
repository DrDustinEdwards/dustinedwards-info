-- Site-wide search index for dustinedwards.info
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- Additive only. `posts`, `posts_fts` and its three per-row triggers are NOT
-- touched. The editor's save path still rides those triggers exactly as it did,
-- and nothing in this migration changes what they do. The tables below are a
-- separate, derived index that the sync path rewrites wholesale.
--
-- WHY TWO FTS TABLES.
-- An fts5 tokenizer is set per TABLE, not per column, so one table cannot serve
-- both match problems. Porter stemming is right for prose and wrong for names
-- and identifiers, where it collapses Edwards to edward and Harris to harri.
-- Splitting the index also handles the bm25 length-normalization problem: bm25
-- divides by average document length with b fixed near 0.75 and fts5 exposes
-- column weights but not b, so in one mixed index a short title row outranks a
-- long prose row on the same term and it cannot be tuned away. The two indexes
-- are fused by RECIPROCAL RANK, never by raw score, because bm25 values from
-- two tokenizers over two different average document lengths are not comparable
-- on value. See app/lib/search/fuse.ts.
--
-- remove_diacritics 2 rather than the default 1: option 1 misses codepoints
-- needing multi-byte handling, and a visitor types ASCII regardless.

-- The one record shape ------------------------------------------------------
--
-- Every indexable thing in the site reduces to this row. The ratified shape is
-- (id, url, type, title, body, date); `uid` is that id, and `publish_at` is
-- that date, named to match `posts` rather than inventing a second convention.
--
-- Records are section-grained. One post yields a document record plus one
-- record per heading, so a query lands on the section that answers it and the
-- result deep-links to that anchor. `doc_uid` groups them back together.

CREATE TABLE search_docs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT NOT NULL UNIQUE,
  url        TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('post', 'page')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  -- Feeds the identity INDEX. Carried by the document record only, so that a
  -- post with six sections does not get its tags counted seven times and
  -- outrank a differently tagged post on section count alone.
  tags       TEXT NOT NULL DEFAULT '',
  -- Feeds FILTERING and facet counts, and is carried by every record including
  -- sections, so `tag:cloudflare` narrows to the sections of tagged posts and
  -- not just their front pages. Pipe-delimited on both ends (|a|b|) so a filter
  -- is an exact `instr(doc_tags, '|' || ? || '|')` rather than a LIKE that would
  -- match `d1` inside `d10`.
  doc_tags   TEXT NOT NULL DEFAULT '',
  -- Grouping. For a document record doc_uid = uid and anchor IS NULL.
  doc_uid    TEXT NOT NULL,
  doc_title  TEXT NOT NULL,
  doc_url    TEXT NOT NULL,
  anchor     TEXT,
  ordinal    INTEGER NOT NULL DEFAULT 0,
  -- Visibility. Carried on the record rather than joined from `posts`, because
  -- a future publish_at must be re-evaluated on every request and an index that
  -- only stored what was visible at sync time would leak a scheduled post the
  -- moment its date passed, or hide it forever. Same predicate as
  -- publiclyVisible() in app/db/index.ts and it must stay in step with it.
  status     TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  publish_at INTEGER
);

-- Covers the visibility predicate every public search read composes.
CREATE INDEX search_docs_visible_idx ON search_docs (status, publish_at);
-- Covers the type facet and its count.
CREATE INDEX search_docs_type_idx ON search_docs (type);
-- Covers collapsing section hits back onto their owning document.
CREATE INDEX search_docs_doc_idx ON search_docs (doc_uid, ordinal);

-- Identity index: exact-token lookup ----------------------------------------
--
-- Titles and tags. No stemming, so a tag reads back as the token it is.

CREATE VIRTUAL TABLE search_identity USING fts5 (
  title,
  tags,
  content = 'search_docs',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Prose index: relevance over paragraphs -------------------------------------

CREATE VIRTUAL TABLE search_prose USING fts5 (
  body,
  content = 'search_docs',
  content_rowid = 'id',
  tokenize = 'porter unicode61 remove_diacritics 2'
);

-- No per-row triggers on search_docs, deliberately.
--
-- `posts_fts` has three because it mirrors a table edited one row at a time.
-- search_docs is DERIVED and is rewritten wholesale by scripts/sync-content.mjs
-- and by the editor's publish path, both of which then issue
--   INSERT INTO search_identity (search_identity) VALUES ('rebuild');
--   INSERT INTO search_prose    (search_prose)    VALUES ('rebuild');
-- which is the documented bulk pattern for an external-content table and the
-- one that does not depend on trigger ordering during a batch.
--
-- Never run DELETE FROM search_identity or DELETE FROM search_prose. On an
-- external-content table that is not a supported operation and it leaves the
-- index corrupt; the next trigger-fired write dies with SQLITE_CORRUPT_VTAB and
-- takes the whole statement batch with it. Rebuild is the repair.
--
-- Also note COUNT(*) on either of these reads THROUGH to search_docs and so can
-- never detect index drift. Count search_identity_docsize and
-- search_prose_docsize instead. sync-content.mjs asserts on the docsize tables
-- for exactly this reason.
