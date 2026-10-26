-- The content's source moves from the repository into D1 (thread "Move dustinedwards.info content to the shared model",
-- 2026-10-26). Every Carrel, admin and operator save wrote a commit to main through a GitHub token and then D1; the
-- "Protect main" ruleset (PR required, 2026-10-22) refused every one of those commits. The other sites keep their
-- source in D1 with a revision table, and so does this one now. Hand-written (drizzle-kit is intentionally not used).
-- Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: three new tables and one index, all EMPTY. No existing table, column or row is touched. The files are put
-- in by scripts/seed-sources.mjs (sync:content runs it), with their git history, and only for a path D1 does not hold.
--
-- source_files is one row per file, keyed by its repository path (content/pages/about.md), so every kind's save keeps
-- its path rules. `sha` is the git blob sha of `content`: the version Carrel holds for the item, unchanged by the move.
-- source_revisions is every version a file has had, newest last; `content` NULL is a delete. source_guard holds no row
-- outside a write: a save inserts `ok = 0` into it when a file changed since it was read, which fails the CHECK and
-- rolls the whole batch back (app/lib/source/store.server.ts).

CREATE TABLE source_files (
  path text PRIMARY KEY NOT NULL,
  content text NOT NULL,
  sha text NOT NULL,
  revision integer NOT NULL,
  updated_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE source_revisions (
  id integer PRIMARY KEY AUTOINCREMENT,
  path text NOT NULL,
  content text,
  sha text,
  message text NOT NULL,
  author text NOT NULL,
  created_at integer NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX source_revisions_path ON source_revisions (path, id);

CREATE TABLE source_guard (
  ok integer NOT NULL CHECK (ok = 1)
);
