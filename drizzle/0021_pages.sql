-- Pages: the Research, Teaching and Software prose pages that content/pages/*.md holds
-- (job_dc67fd83c24b, docs/PAGES.md). Number 0020 belongs to the publications table.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new table. No existing table, column or row is touched.
--
-- DERIVED, under hard rule 18. The repository file is the source; a row is written only
-- by app/lib/pages/compile.mjs, through sync:content or the page save (save.server.ts, called by the site-api adapter), and
-- a failed write here never reverts the file. The page is drawn from this row at request
-- time, which is what lets a content edit go live without a build or a deploy.
--
-- `record` IS THE RENDERED PAGE AS JSON: its markdown already turned to HTML by the site's
-- pipeline, with the typed structured-data facts its front matter states. `markdown` is the
-- twin a machine reads at the page's `.md` address. Both come from the same compile, so they
-- carry the same facts.
--
-- `slug` is the file key (research-phages for content/pages/research-phages.md), which a
-- path maps to by the rule in app/lib/content-pages.mjs. `path` is one of CONTENT_PAGE_PATHS:
-- a save cannot create a path, because a page's address is structure and lives in code.
--
-- `status` follows posts and procedures: draft or published. A draft is served only to a
-- signed-in admin, is absent from the sitemap and the search index, and its twin answers 404.

CREATE TABLE pages (
  id integer PRIMARY KEY AUTOINCREMENT,
  slug text NOT NULL UNIQUE,
  path text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  record text NOT NULL,
  markdown text NOT NULL,
  source_path text NOT NULL UNIQUE,
  source_blob_sha text NOT NULL,
  synced_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT pages_status_check CHECK (status in ('draft', 'published'))
);

CREATE INDEX pages_status_idx ON pages (status);
