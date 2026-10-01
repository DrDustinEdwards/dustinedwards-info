-- Dictionary entries: the pronunciation, senses and etymology that open the named Software pages
-- (job_06a07623695b, docs/DICTIONARY.md) were code in app/lib/dictionary-entries.mjs. Numbers 0022 and 0024
-- belong to other tables, so this one is 0023.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched.
--
-- DERIVED, under hard rule 18. The repository file content/dictionary/<key>.md is the source; a row is
-- written only by app/lib/dictionary/compile.mjs, through sync:content or the dictionary save
-- (save.server.ts, called by the site-api adapter), and a failed write here never reverts the file. The
-- page's lead, its markdown twin, its search record and its DefinedTerm JSON-LD are drawn from this row, which
-- is what lets an entry edit go live without a build or a deploy.
--
-- `key` is the file's name without .md (capsid for content/dictionary/capsid.md). `path` is the registered
-- Software page the entry opens (/software/capsid), and a page opens with one entry. `record` is the entry as
-- JSON, in the shape app/lib/dictionary-entries.mjs formats; the file's notes body is not stored.
--
-- `status` follows posts and pages: draft or published. A draft entry is not shown on its page, in its twin
-- or in its search record.

CREATE TABLE dictionary_entries (
  id integer PRIMARY KEY AUTOINCREMENT,
  key text NOT NULL UNIQUE,
  path text NOT NULL UNIQUE,
  term text NOT NULL,
  status text NOT NULL,
  record text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT dictionary_entries_status_check CHECK (status in ('draft', 'published'))
);

CREATE INDEX dictionary_entries_status_idx ON dictionary_entries (status);
