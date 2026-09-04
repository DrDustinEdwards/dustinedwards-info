-- Received webmentions, item H1. The moderation queue and nothing that renders.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]

-- WHAT THIS TABLE IS FOR. Another site publishes a page linking to a post
-- here and POSTs `source` and `target` to /webmention. That endpoint writes a
-- row, fetches the source, and moves the row to `pending` if the link is
-- really there. Nothing renders until the admin approves it, and rendering
-- itself is H2: an approved row has no public effect in this migration's
-- lifetime.
--
-- IT IS NEITHER AUTHORED NOR DERIVED, which is new here. `posts` is authored
-- in the repository. `media`, `media_refs` and `search_docs` are derived and
-- converge toward the repository and the bucket under hard rule 18. These rows
-- came from strangers and converge toward nothing, so a rebuild cannot repair
-- this table and no gate can reconcile it against a source. The only bound on
-- its size is the endpoint's, and the four bounds are stated in
-- app/routes/webmention.ts rather than restated here.
--
-- NO IP COLUMN. The per-IP rate limit is a Durable Object counter keyed on
-- `wm:<ip>` that expires with its window; nothing about the sender's transport
-- is stored. What is stored is what the sender's own page says: a URL they
-- published, a name from their h-card if they publish one, and a sentence of
-- their prose. /privacy states exactly that, and this absence is what makes
-- the statement true rather than a promise.
--
-- `target_slug` IS A SLUG AND NOT A URL. A stored URL would carry the origin
-- it arrived on, and this site answers on workers.dev today and on the apex
-- after cutover; rows written before the move would name a host the render no
-- longer uses, and the unique index below would treat two spellings of one
-- post as two targets. The slug is what `posts` is keyed by and it does not
-- move.
--
-- TIMESTAMPS ARE UNIX INTEGERS, matching `posts.created_at` rather than
-- `media.created_at`, which is a `datetime('now')` string. Both shapes exist
-- in this database and the posts shape is the one a row with a retention
-- window needs, because an integer comparison against `unixepoch()` is what
-- the sweep does.

CREATE TABLE webmentions (
  id integer PRIMARY KEY AUTOINCREMENT,
  source_url text NOT NULL,
  target_slug text NOT NULL,
  status text NOT NULL,
  author_name text,
  author_url text,
  excerpt text,
  failure_reason text,
  received_at integer NOT NULL DEFAULT (unixepoch()),
  verified_at integer,
  decided_at integer,
  CONSTRAINT webmentions_status_check CHECK (
    status in ('unverified', 'pending', 'approved', 'rejected', 'failed')
  )
);

-- ONE ROW PER (SOURCE, TARGET). The third of the endpoint's four bounds, and
-- the one that makes the table's size a function of the internet rather than
-- of how fast somebody can POST: a re-sent mention updates its row.
CREATE UNIQUE INDEX webmentions_source_target_idx ON webmentions (source_url, target_slug);

-- Covers the moderation queue's grouping and the retention sweep's window.
CREATE INDEX webmentions_status_received_idx ON webmentions (status, received_at);
