-- The author-written post history. Additive: one nullable column on an
-- existing table, no column altered and no row rewritten.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]

-- WHAT IT HOLDS: a JSON array of { date, note }, matching `related`,
-- `further_reading` and `key_takeaways` rather than inventing a fourth
-- convention for a list in a database that has already answered the question.
--
-- WHY IT IS AUTHORED AND NOT DERIVED. `updated_at` already exists and already
-- says WHEN; it cannot say WHAT, and it is written by every sync, so it is a
-- deploy timestamp with an edit's name. A changelog is prose about a revision
-- and only the author has it. It travels in frontmatter like every other
-- authored field, so `posts` stays derived from the repository under hard
-- rule 18 and a rebuild through `renderAndWrite` repairs it.
--
-- NULLABLE, WITH NO DEFAULT, because almost every post has one. Most posts are
-- never revised at all, which is what the 24-hour threshold in blog.$slug.tsx
-- is there to keep true.
--
-- NO CHECK ON THE DATE SHAPE. The zod schema in app/lib/content/pipeline.mjs
-- refuses anything that is not YYYY-MM-DD at the post that set it, naming the
-- file; a CHECK would fail later during a sync, naming a row.

ALTER TABLE posts ADD COLUMN changelog text;
