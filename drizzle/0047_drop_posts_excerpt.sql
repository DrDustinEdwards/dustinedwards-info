-- contract: drops posts.excerpt, which no code writes or reads (NULL on every row).
-- Hand-written. A deploy refuses a drop, so the column is dropped by hand AFTER the code that no longer names it is
-- live at 100% (every post read lists the table's columns, so dropping it earlier breaks the previous deploy):
--   wrangler d1 execute dustinedwards --remote --command "ALTER TABLE posts DROP COLUMN excerpt"
ALTER TABLE posts DROP COLUMN excerpt;
