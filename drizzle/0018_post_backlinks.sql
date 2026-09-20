-- The posts on this site that link TO a post. Additive: one nullable column on
-- an existing table, no column altered and no row rewritten.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]

-- A JSON array of { slug, title }, the same convention as `related`,
-- `further_reading`, `key_takeaways` and `changelog`.
--
-- WHY A COLUMN AND NOT A QUERY. A backlink is a property of the whole corpus,
-- exactly like `related` beside it: publishing one post changes the backlink
-- list of every post it links to. Computing it per request would mean a LIKE
-- scan of every rendered body on a public read path, and it would put a second
-- statement of "what a link to a post looks like" in SQL, away from the one in
-- app/lib/content/pipeline.mjs that the build uses.
--
-- NULLABLE, WITH NO DEFAULT. A post nothing links to has no list, and a row
-- written before this column existed has never been scanned; both are absent
-- rather than empty, and the renderer shows the section only when there is one.
--
-- THE READER STILL RE-CHECKS IT. The list is written at build time and a
-- linking post can be unpublished afterwards, so blog.$slug.tsx passes these
-- slugs through publiclyVisibleSlugs with the related ones.

ALTER TABLE posts ADD COLUMN backlinks text;
