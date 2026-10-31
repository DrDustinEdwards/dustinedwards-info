-- The people a post credits (site-api's `authors` post field, area 5): a JSON array of display names in credit order,
-- from the post's front matter. NULL when the front matter names none, which the pages read as the site's owner alone.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: one new nullable column. No row is rewritten.

ALTER TABLE posts ADD COLUMN authors text;
