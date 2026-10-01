-- Publications: the papers content/publications/*.md holds (docs/PUBLICATIONS.md), and the citation
-- counts the pages show beside them.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: two new tables. No existing table, column or row is touched.
--
-- `publications` is DERIVED, under hard rule 18. The repository file is the source; a row is written only
-- by app/lib/publications/compile.mjs, through sync:content or the Carrel adapter's save, and a failed
-- write here never reverts the file. The pages, the exports and the markdown twin are drawn from the row
-- at request time, which is what lets an edit go live without a build or a deploy.
--
-- `record` IS THE COMPILED PUBLICATION AS JSON (app/lib/publications/types.ts), without the raw Crossref
-- record and the extracted text. `csl` is that raw record, kept apart because only the .json export reads
-- it. `markdown` is the twin at /research/publications/<slug>.md, whole, full text included, so the page
-- query never reads it. All three come from one compile, so they carry the same facts.
--
-- `status` follows posts and procedures: draft or published. A draft is absent from the index, the
-- exports, the sitemap and search, and its page and twin answer 404. `stage` is the paper's own state:
-- published, or a manuscript that is submitted and has no DOI yet.

CREATE TABLE publications (
  id integer PRIMARY KEY AUTOINCREMENT,
  slug text NOT NULL UNIQUE,
  doi_key text,
  status text NOT NULL,
  stage text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  year integer NOT NULL,
  selected integer NOT NULL DEFAULT 0,
  record text NOT NULL,
  csl text,
  markdown text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT publications_status_check CHECK (status in ('draft', 'published')),
  CONSTRAINT publications_stage_check CHECK (stage in ('published', 'submitted')),
  CONSTRAINT publications_type_check CHECK (type in ('article', 'review', 'chapter', 'abstract', 'teaching-resource'))
);

CREATE INDEX publications_status_idx ON publications (status, year);
-- `doi_key` is the DOI lower-cased: DOI names are case-insensitive, so two casings are one work. The DOI as
-- deposited is in `record`. NULLs (a manuscript) never collide.
CREATE UNIQUE INDEX publications_doi_key_idx ON publications (doi_key);

-- The count a page shows for a paper, kept with no expiry: a page never shows a blank for a paper that
-- once had a count, because a refresh REPLACES a row and never deletes one. Keyed by the lower-cased DOI.
-- `fetched_at` is the day OpenAlex was read (YYYY-MM-DD); `url` is OpenAlex's own id for the work.
-- Seeded by sync:content from data/publications.cited-by.json and refreshed by the operator API's
-- refresh_citations, which the watchdog calls weekly.
CREATE TABLE publication_citations (
  doi text PRIMARY KEY,
  count integer NOT NULL,
  url text,
  fetched_at text NOT NULL,
  CONSTRAINT publication_citations_count_check CHECK (count >= 0)
);
