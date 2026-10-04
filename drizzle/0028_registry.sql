-- The lab registry: the reference catalog of the lab's primers, strains, reagents and equipment that
-- content/registry/<kind>/<id>.md holds (job_915d43f44cee, docs/REGISTRY.md). Number 0028 is this job's.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched, and the table starts EMPTY: this
-- migration ships with no records, so nothing reads it until a kind is defined in app/lib/registry/kinds.mjs.
--
-- DERIVED, under hard rule 18. The repository file is the source; a row is written only by
-- app/lib/registry/compile.mjs's output, through sync:content or the registry save (save.server.ts, called by the
-- site-api adapter), and a failed write here never reverts the file. The row's blob sha is what the registry-drift
-- check reads as current.
--
-- One row per item. The shared columns are the ones every kind has (its kind, its id within the kind, its name and
-- its status); the rest of what a kind knows lives in `record`, the kind's own fields as JSON, exactly the fields the
-- file carries and no others, validated by the kind's own rules. Nothing a kind states is stored twice: the name and
-- the status are columns only, and the record never repeats them.
-- `status` is `published` (public) or `draft` (a signed-in admin only), read from the file's `draft` flag like a page. Phages keep their own
-- table; the registry holds no phage.
--
-- Stock counts, storage locations and sample data are not a registry fact and have no column.

CREATE TABLE registry (
  kind text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  record text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (kind, id),
  CONSTRAINT registry_status_check CHECK (status in ('published', 'draft'))
);

CREATE INDEX registry_kind_name_idx ON registry (kind, name);
