-- Run records with the lots they used (job_4409e06c39d4, docs/KNOWLEDGE-BASE.md step 7, research finding P2): a lab
-- member records a run of a protocol in /lab, naming the lots of each reagent it used, so a bad lot traces to every
-- run that used it. Number 0031 is this job's. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: two new tables, four triggers on them and two indexes, all EMPTY. No existing table, column or row is
-- touched.
--
-- APPEND-ONLY (Dustin, 2026-10-11). A saved run is never edited or deleted: a correction is a new run whose
-- `replaces_run_id` names the run it replaces, and a run is replaced at most once (UNIQUE), so the corrections of a
-- run form one line. The triggers refuse any UPDATE or DELETE on either table, so no code path can rewrite one.
-- `uid` is the run's own random id, minted by the Worker, so the run's lots can name it in the same batch.
--
-- A run's lot changes (the amount it used, the day a lot was first opened, a lot it emptied) are writes to `kb_lots`,
-- and each writes a `kb_audit` row with the lot before and after, as every lot change does (drizzle/0029).
-- PRIVATE: runs are lab members' records, never published, including as JSON-LD (DECIDE 5). Dates are YYYY-MM-DD.

CREATE TABLE kb_runs (
  id integer PRIMARY KEY AUTOINCREMENT,
  uid text NOT NULL UNIQUE,
  procedure_slug text NOT NULL,
  procedure_version text,
  actor text NOT NULL,
  run_on text NOT NULL,
  outcome text NOT NULL DEFAULT 'completed',
  note text,
  replaces_run_id integer UNIQUE REFERENCES kb_runs (id),
  created_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT kb_runs_outcome_check CHECK (outcome in ('completed', 'failed', 'abandoned')),
  CONSTRAINT kb_runs_run_on_check CHECK (run_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX kb_runs_actor_idx ON kb_runs (actor, created_at);

CREATE TABLE kb_run_lots (
  run_id integer NOT NULL REFERENCES kb_runs (id),
  lot_id integer NOT NULL REFERENCES kb_lots (id),
  amount_used real,
  unit text,
  emptied integer NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, lot_id),
  CONSTRAINT kb_run_lots_amount_check CHECK (amount_used IS NULL OR amount_used >= 0),
  CONSTRAINT kb_run_lots_emptied_check CHECK (emptied in (0, 1))
);

CREATE INDEX kb_run_lots_lot_idx ON kb_run_lots (lot_id);

CREATE TRIGGER kb_runs_no_update BEFORE UPDATE ON kb_runs
BEGIN
  SELECT RAISE(ABORT, 'a saved run is never changed: record a correction that names it instead');
END;

CREATE TRIGGER kb_runs_no_delete BEFORE DELETE ON kb_runs
BEGIN
  SELECT RAISE(ABORT, 'a saved run is never deleted: record a correction that names it instead');
END;

CREATE TRIGGER kb_run_lots_no_update BEFORE UPDATE ON kb_run_lots
BEGIN
  SELECT RAISE(ABORT, 'a saved run is never changed: record a correction that names it instead');
END;

CREATE TRIGGER kb_run_lots_no_delete BEFORE DELETE ON kb_run_lots
BEGIN
  SELECT RAISE(ABORT, 'a saved run is never deleted: record a correction that names it instead');
END;
