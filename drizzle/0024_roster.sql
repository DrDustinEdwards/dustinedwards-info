-- Roster: the Phage Discovery Program cohorts that content/roster/*.md holds (job_06a07623695b, docs/ROSTER.md).
-- Numbers 0022 and 0023 belong to other jobs.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched.
--
-- DERIVED, under hard rule 18. The repository file is the source; a row is written only by
-- app/lib/roster/compile.mjs's output, through sync:content or the roster save (save.server.ts, called by
-- the site-api adapter), and a failed write here never reverts the file. The home page's counts and the
-- roster on /teaching/phage-discovery are drawn from these rows at request time, which is what lets a
-- roster edit go live without a build or a deploy.
--
-- One row per cohort, the file key being the year (content/roster/2025.md is slug 2025). `record` is the
-- cohort as JSON, exactly the three fields the file carries (year, photo, researchers) and no others: the
-- table holds nothing the public page does not already show.

CREATE TABLE roster (
  id integer PRIMARY KEY AUTOINCREMENT,
  slug text NOT NULL UNIQUE,
  year integer NOT NULL UNIQUE,
  record text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch())
);
