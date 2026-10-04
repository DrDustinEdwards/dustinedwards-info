-- Procedure versions: a frozen, rendered copy of every published version of a procedure, so the
-- printed bench sheet's QR code opens the exact version it was printed from and a citation of a
-- version keeps pointing at that version (protocols.md; dustinedwards/decisions.md, 2026-10-04).
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table and two triggers. No existing table, column or row is touched.
--
-- NOT DERIVED, which is the one place this departs from hard rule 18: the procedures table follows
-- the repository file, and this table must not. A row is written once, when a version is first
-- published, from the same compile that writes the live row (app/lib/procedures/save.server.ts,
-- writeRow), and is then never changed. The triggers below refuse an UPDATE or DELETE of a sealed
-- row, so a later edit, a buggy sync or a hand-written statement cannot alter a printed version.
-- To correct a published version, bump the version in the file and add a history entry.
--
-- `record` and `markdown` are exactly what the live row held when the version was frozen: the
-- rendered procedure as JSON (its HTML fragments already rendered) and its markdown twin. The page
-- for the version is drawn from `record` by the shared components, so the words are frozen and the
-- chrome around them is not.
--
-- `sealed` is 0 only while sync:content appends a large row in pieces (D1 refuses one statement over
-- 100 KB); the last statement sets it to 1. A row still at 0 is never served and may be replaced.

CREATE TABLE procedure_versions (
  slug text NOT NULL,
  version text NOT NULL,
  path text NOT NULL,
  profile text NOT NULL,
  record text NOT NULL,
  markdown text NOT NULL,
  source_blob_sha text NOT NULL,
  sealed integer NOT NULL DEFAULT 0,
  frozen_at integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (slug, version),
  CONSTRAINT procedure_versions_profile_check CHECK (profile in ('protocol', 'recipe', 'computational')),
  CONSTRAINT procedure_versions_sealed_check CHECK (sealed in (0, 1))
);

CREATE TRIGGER procedure_versions_sealed_no_update BEFORE UPDATE ON procedure_versions
WHEN OLD.sealed = 1
BEGIN
  SELECT RAISE(ABORT, 'a frozen procedure version is never changed: bump the version in the file instead');
END;

CREATE TRIGGER procedure_versions_sealed_no_delete BEFORE DELETE ON procedure_versions
WHEN OLD.sealed = 1
BEGIN
  SELECT RAISE(ABORT, 'a frozen procedure version is never deleted');
END;
