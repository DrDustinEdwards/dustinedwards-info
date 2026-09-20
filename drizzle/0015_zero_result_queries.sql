-- Zero-result search queries, as demand signal. Additive: one new table, no
-- existing column touched.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]

-- WHAT THIS TABLE IS FOR. A reader searches, the index returns nothing, and
-- that is the one search result worth keeping: it names something somebody
-- expected this site to have. Aggregated in admin, it is a writing queue.
--
-- IT IS THE SECOND TABLE THAT IS NEITHER AUTHORED NOR DERIVED, after
-- `webmentions`, and the same consequence follows: `posts` is authored in the
-- repository, `media`, `media_refs` and `search_docs` are derived and converge
-- toward the repository and the bucket under hard rule 18, and these rows
-- converge toward nothing. A rebuild cannot repair this table and no gate can
-- reconcile it against a source. What bounds it is the retention sweep below
-- and the unique index, not a rebuild.
--
-- NO IP, NO USER AGENT, NO SESSION, NO COOKIE, AND NO FINGERPRINT. The table
-- has four columns and three of them are counters; there is deliberately
-- nowhere to put a reader. This is not a policy the writer applies, it is a
-- shape: a column that does not exist cannot be filled in later by somebody
-- who did not read this comment. /privacy can state that no search is
-- attributable to a reader, and the absence of these columns is what makes
-- that statement true rather than a promise.
--
-- THE QUERY IS CAPPED AT 200 CHARACTERS, enforced by a CHECK rather than only
-- by the writer. A query longer than that is not a question, and the cap is
-- the difference between a demand signal and a place to put arbitrary text.
--
-- ONE ROW PER NORMALISED QUERY, not one per search. The same miss asked fifty
-- times is one gap asked fifty times, which is what `count` says. This is also
-- what keeps the table's size a function of the distinct things people look
-- for rather than of how often they look.
--
-- TIMESTAMPS ARE UNIX INTEGERS, matching `posts.created_at` and
-- `webmentions.received_at` rather than `media.created_at`, which is a
-- `datetime('now')` string. Both shapes exist in this database and the integer
-- one is what a row with a retention window needs: the sweep compares against
-- `unixepoch()`.

CREATE TABLE zero_result_queries (
  query text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  first_seen integer NOT NULL DEFAULT (unixepoch()),
  last_seen integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT zero_result_queries_length_check CHECK (length(query) <= 200),
  CONSTRAINT zero_result_queries_nonempty_check CHECK (length(query) > 0)
);

-- Covers both readers: the admin list orders by demand, and the 90-day
-- retention sweep selects on the window.
CREATE INDEX zero_result_queries_count_idx ON zero_result_queries (count DESC);
CREATE INDEX zero_result_queries_last_seen_idx ON zero_result_queries (last_seen);
