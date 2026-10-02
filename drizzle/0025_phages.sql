-- Phages: the rows of the phage table on /research/phages, with each phage's PhagesDB link, that content/phages/*.md
-- holds (job_005b85bf32fc, docs/PHAGES.md). Number 0025 is this job's; 0026 belongs to another.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched.
--
-- DERIVED, under hard rule 18. The repository file is the source; a row is written only by
-- app/lib/phages/compile.mjs's output, through sync:content or the phage save (save.server.ts, called by the
-- site-api adapter), and a failed write here never reverts the file. The page /research/phages is compiled from
-- these rows (its table and its per-phage sections), so its row in `pages`, its markdown twin and its search
-- records are re-derived whenever a phage changes: the page's own row first, this table's row last, because this
-- row's blob sha is what the phage-drift check reads as current.
--
-- One row per phage, the file key being the name in lower case (content/phages/acorn15.md is slug acorn15).
-- `record` is the phage as JSON, exactly the fields the file carries (name, year, host, county, phagesdb, paper,
-- formerly, note) and no others: the table holds nothing the public page does not already show.

CREATE TABLE phages (
  id integer PRIMARY KEY AUTOINCREMENT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  year integer NOT NULL,
  record text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX phages_year_idx ON phages (year);
