-- contract: drops the Ask upload ledger, which the D1 data source replaced.
--
-- The Ask index is now an AI Search instance whose data source is this database (ASK_INDEX_QUERY in
-- app/lib/search/search.server.ts): AI Search reads the corpus itself and indexes only what changed, so nothing is
-- uploaded and no hash of an upload is kept. The table held only derived hashes (0043), never content. Hand-written.
-- Hand-run on production before the merge, since a deploy refuses a drop:
--   wrangler d1 execute dustinedwards --remote --file drizzle/0045_drop_ask_uploads.sql
DROP TABLE IF EXISTS ask_uploads;
