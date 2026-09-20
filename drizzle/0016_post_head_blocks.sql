-- The three optional author-set head blocks. Additive: three nullable columns
-- on an existing table, no column altered and no row rewritten.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]

-- WHY COLUMNS AT ALL, when these are authored in frontmatter. `posts` is
-- DERIVED from the repository under hard rule 18, and the public post route
-- reads the rendered row rather than the markdown: D1 holds the only rendered
-- copy. A field that is not a column is a field the page cannot show. These
-- converge toward the repository like every other column here, so a rebuild
-- through `renderAndWrite` repairs them and `content-drift` reconciles them.
--
-- NULLABLE, WITH NO DEFAULT, because absent is the normal case. Most posts set
-- none of the three, and a default would make "the author said nothing" and
-- "the author said this" the same value.
--
-- `key_takeaways` IS JSON IN A TEXT COLUMN, matching `related` and
-- `further_reading` above it rather than inventing a second convention for a
-- list. SQLite has no array type and this database already answered the
-- question once.
--
-- NOT CALLED `status`, WHICH IS TAKEN. `posts.status` is the draft/published
-- visibility column, notNull with its own enum. The editorial tag is a
-- different fact about the same row, and the name also removes a second
-- confusion: a post may be published (`draft: false`) while its prose is a
-- draft (`writing_status: draft`), which is exactly what the vocabulary means.
--
-- NO CHECK ON `writing_status`. The five words are enforced by the zod enum in
-- app/lib/content/pipeline.mjs, at the point where a bad value can be reported
-- against the post that set it and the line it is on. A CHECK here would fail
-- the same value later, during a sync, naming a row instead of a file. One
-- owner, and it is the one that can say where the mistake is.

ALTER TABLE posts ADD COLUMN writing_status text;
ALTER TABLE posts ADD COLUMN assumed_audience text;
ALTER TABLE posts ADD COLUMN key_takeaways text;
