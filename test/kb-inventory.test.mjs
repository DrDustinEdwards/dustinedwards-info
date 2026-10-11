// The inventory migration (drizzle/0029_kb_inventory.sql, job_898286365026): its constraints hold on a real SQLite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const sql = readFileSync(new URL("../drizzle/0029_kb_inventory.sql", import.meta.url), "utf8");

function fresh() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(sql);
  return db;
}

const lot = "INSERT INTO kb_lots (item_kind, item_id, lot_number, amount) VALUES (?, ?, ?, ?)";

test("the three tables start empty", () => {
  const db = fresh();
  for (const t of ["kb_locations", "kb_lots", "kb_audit"]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n, 0, t);
  }
});

test("a lot is unique per item and lot number, and a lot starts in stock", () => {
  const db = fresh();
  db.prepare(lot).run("reagents", "tes-buffer", "L1", 10);
  assert.equal(db.prepare("SELECT status FROM kb_lots").get().status, "in_stock");
  assert.throws(() => db.prepare(lot).run("reagents", "tes-buffer", "L1", 5), /UNIQUE/);
  db.prepare(lot).run("reagents", "tes-buffer", "L2", 5);
});

test("a lot refuses a negative amount and an unknown status", () => {
  const db = fresh();
  assert.throws(() => db.prepare(lot).run("reagents", "x", "L1", -1), /CHECK/);
  db.prepare(lot).run("reagents", "x", "L2", 1);
  assert.throws(() => db.prepare("UPDATE kb_lots SET status = 'lost'").run(), /CHECK/);
});

test("a lot's location must exist", () => {
  const db = fresh();
  assert.throws(() => db.prepare("INSERT INTO kb_lots (item_kind, item_id, lot_number, location_id) VALUES ('a','b','c',99)").run(), /FOREIGN KEY/);
  db.prepare("INSERT INTO kb_locations (name) VALUES ('Freezer 1')").run();
  db.prepare("INSERT INTO kb_lots (item_kind, item_id, lot_number, location_id) VALUES ('a','b','c',1)").run();
  assert.throws(() => db.prepare("INSERT INTO kb_locations (name) VALUES ('Freezer 1')").run(), /UNIQUE/);
});

test("the audit takes only the actions and tables it names", () => {
  const db = fresh();
  const audit = "INSERT INTO kb_audit (actor, table_name, row_id, action) VALUES (?, ?, 1, ?)";
  db.prepare(audit).run("a@example.org", "kb_lots", "insert");
  assert.throws(() => db.prepare(audit).run("a@example.org", "kb_lots", "merge"), /CHECK/);
  assert.throws(() => db.prepare(audit).run("a@example.org", "registry", "update"), /CHECK/);
});
