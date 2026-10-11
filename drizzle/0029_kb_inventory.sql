-- The Knowledge Base's inventory: where a reagent or piece of equipment is, and which lot of it is on the shelf
-- (job_898286365026, docs/KNOWLEDGE-BASE.md step 4, DECIDE 1). Number 0029 is this job's.
-- Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: three new tables. No existing table, column or row is touched, and all three start EMPTY. Nothing reads
-- or writes them yet: no sign-in, role or page is added here (DECIDE 3 waits for job_4acb6ae89b9f).
--
-- SOURCE OF TRUTH, unlike the registry. An item's public facts (name, supplier, catalog number) stay in
-- content/registry/ and D1 serves them (hard rule 18). A lot's number, expiry, amount and place change daily, are
-- edited by lab people and are private, so D1 is their source and they are never committed to the public repository.
-- The bucket backup covers these tables (check:backup).
--
-- `kb_lots.item_kind` and `item_id` name a registry item by its address. There is no foreign key: the registry is a
-- derived table that sync:content rewrites, and a lot must outlive a rewrite.
-- Dates are ISO text (YYYY-MM-DD), amounts are in `unit`.
--
-- `kb_audit` is append-only: every write to a lot or a location adds one row (who, when, what, the row before and
-- after as JSON), so the history a file would have given is kept.

CREATE TABLE kb_locations (
  id integer PRIMARY KEY AUTOINCREMENT,
  name text NOT NULL UNIQUE,
  parent_id integer REFERENCES kb_locations (id),
  note text
);

CREATE TABLE kb_lots (
  id integer PRIMARY KEY AUTOINCREMENT,
  item_kind text NOT NULL,
  item_id text NOT NULL,
  lot_number text NOT NULL,
  expiry text,
  amount real,
  unit text,
  location_id integer REFERENCES kb_locations (id),
  received text,
  opened text,
  status text NOT NULL DEFAULT 'in_stock',
  created_at integer NOT NULL DEFAULT (unixepoch()),
  updated_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT kb_lots_status_check CHECK (status in ('in_stock', 'empty', 'discarded')),
  CONSTRAINT kb_lots_amount_check CHECK (amount IS NULL OR amount >= 0)
);

CREATE UNIQUE INDEX kb_lots_item_kind_item_id_lot_number_unique ON kb_lots (item_kind, item_id, lot_number);

CREATE INDEX kb_lots_location_idx ON kb_lots (location_id);

CREATE TABLE kb_audit (
  id integer PRIMARY KEY AUTOINCREMENT,
  at integer NOT NULL DEFAULT (unixepoch()),
  actor text NOT NULL,
  table_name text NOT NULL,
  row_id integer NOT NULL,
  action text NOT NULL,
  before_row text,
  after_row text,
  CONSTRAINT kb_audit_action_check CHECK (action in ('insert', 'update', 'delete')),
  CONSTRAINT kb_audit_table_check CHECK (table_name in ('kb_lots', 'kb_locations'))
);

CREATE INDEX kb_audit_row_idx ON kb_audit (table_name, row_id, at);
