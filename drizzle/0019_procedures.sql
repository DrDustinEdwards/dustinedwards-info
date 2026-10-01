-- Procedures: the lab protocols, and later recipes and computational procedures, that
-- content/procedures/*.md holds (job_86709d790a73, docs/PROCEDURES.md).
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched.
--
-- DERIVED, under hard rule 18. The repository file is the source; a row is written only
-- by app/lib/procedures/compile.mjs, through sync:content or the operator API's
-- save_procedure, and a failed write here never reverts the file. The page is drawn
-- from this row at request time, which is what lets a content edit go live without a
-- build or a deploy.
--
-- `record` IS THE RENDERED PROCEDURE AS JSON: its markdown fragments already turned to
-- HTML by the site's pipeline, its gaps left out. The page renders it with shared
-- components and fills in scaled quantities per request. `markdown` is the twin a
-- machine reads at the page's `.md` address. Both come from the same compile, so they
-- carry the same facts.
--
-- `status` follows posts: draft or published. A draft is served only to a signed-in
-- admin, is absent from the sitemap and the search index, and its twin answers 404.

CREATE TABLE procedures (
  id integer PRIMARY KEY AUTOINCREMENT,
  slug text NOT NULL UNIQUE,
  path text NOT NULL UNIQUE,
  profile text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  version text,
  updated text,
  record text NOT NULL,
  markdown text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT procedures_profile_check CHECK (profile in ('protocol', 'recipe', 'computational')),
  CONSTRAINT procedures_status_check CHECK (status in ('draft', 'published'))
);

CREATE INDEX procedures_status_idx ON procedures (status, profile);
