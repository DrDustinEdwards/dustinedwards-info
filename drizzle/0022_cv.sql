-- The CV: the files in content/cv/ (docs/CV.md). Numbers 0020 and 0021 belong to the publications and pages
-- tables. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched.
--
-- DERIVED, under hard rule 18. The repository file is the source; a row is written only by
-- app/lib/cv/compile.mjs, through sync:content or the CV save (app/lib/cv/save.server.ts, called by the site-api
-- adapter), and a failed write here never reverts the file. The CV page, its markdown twin, its charts and its
-- search records are drawn from these rows at request time, which is what lets a CV edit go live without a
-- build or a deploy.
--
-- ONE ROW PER FILE: the profile (edition, person, presentation totals) and one section file per entry type.
-- `record` is the file's validated content as JSON, entries in the file's order, each entry carrying its type.
-- A paper the CV cites is named by its DOI in that record and joined to the publications table at read time,
-- so a corrected paper reaches the CV with no write here.
--
-- `slug` is the file's name without .md; the set of slugs is CV_FILES (app/lib/cv/parse.mjs), structure that
-- a save cannot extend.

CREATE TABLE cv (
  id integer PRIMARY KEY AUTOINCREMENT,
  slug text NOT NULL UNIQUE,
  type text NOT NULL,
  record text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT cv_type_check CHECK (type in ('profile', 'appointment', 'education', 'publication', 'grant', 'award', 'talk', 'course', 'mentoring', 'service', 'development'))
);
