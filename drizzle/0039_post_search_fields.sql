-- site-api's search fields for a post: searchTitle, image, imageAlt, canonical and noindex, as one JSON object
-- (`description` already has its column). Additive: one nullable column, no row rewritten.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- DERIVED, like every posts column: Carrel writes the fields into the post's frontmatter under site-api's shared
-- names, and a save or `sync:content` renders them here, so the public route reads them from the row.
-- NULL when the post sets none, which is the normal case.
ALTER TABLE posts ADD COLUMN search_fields text;
