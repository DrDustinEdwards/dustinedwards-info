// The run records migration (drizzle/0031_kb_runs.sql, job_4409e06c39d4): runs are append-only on a real SQLite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const inventory = readFileSync(new URL("../drizzle/0029_kb_inventory.sql", import.meta.url), "utf8");
const runs = readFileSync(new URL("../drizzle/0031_kb_runs.sql", import.meta.url), "utf8");

function fresh() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(inventory);
  db.exec(runs);
  db.prepare("INSERT INTO kb_lots (item_kind, item_id, lot_number, amount) VALUES ('reagent', 'ethanol', 'L1', 10)").run();
  db.prepare("INSERT INTO kb_runs (uid, procedure_slug, actor, run_on) VALUES ('u1', 'phage-dna-extraction', 'rosa@example.org', '2026-10-11')").run();
  db.prepare("INSERT INTO kb_run_lots (run_id, lot_id, amount_used) VALUES (1, 1, 2)").run();
  return db;
}

test("a saved run and its lots are never changed or deleted", () => {
  const db = fresh();
  assert.throws(() => db.prepare("UPDATE kb_runs SET note = 'edited'").run(), /never changed/);
  assert.throws(() => db.prepare("DELETE FROM kb_runs").run(), /never deleted/);
  assert.throws(() => db.prepare("UPDATE kb_run_lots SET amount_used = 1").run(), /never changed/);
  assert.throws(() => db.prepare("DELETE FROM kb_run_lots").run(), /never deleted/);
});

test("a correction names the run it replaces, and a run is replaced once", () => {
  const db = fresh();
  db.prepare("INSERT INTO kb_runs (uid, procedure_slug, actor, run_on, replaces_run_id) VALUES ('u2', 'phage-dna-extraction', 'rosa@example.org', '2026-10-11', 1)").run();
  assert.throws(
    () => db.prepare("INSERT INTO kb_runs (uid, procedure_slug, actor, run_on, replaces_run_id) VALUES ('u3', 'phage-dna-extraction', 'rosa@example.org', '2026-10-11', 1)").run(),
    /UNIQUE/,
  );
  assert.throws(() => db.prepare("INSERT INTO kb_runs (uid, procedure_slug, actor, run_on, replaces_run_id) VALUES ('u4', 'x', 'a', '2026-10-11', 99)").run(), /FOREIGN KEY/);
});

test("a run's outcome, day and lots hold their rules", () => {
  const db = fresh();
  assert.throws(() => db.prepare("INSERT INTO kb_runs (uid, procedure_slug, actor, run_on, outcome) VALUES ('u5', 'x', 'a', '2026-10-11', 'great')").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO kb_runs (uid, procedure_slug, actor, run_on) VALUES ('u6', 'x', 'a', 'today')").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO kb_run_lots (run_id, lot_id) VALUES (1, 99)").run(), /FOREIGN KEY/);
  assert.throws(() => db.prepare("INSERT INTO kb_run_lots (run_id, lot_id) VALUES (1, 1)").run(), /UNIQUE|PRIMARY/);
});
