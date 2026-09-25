import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { classifySqliteTables } from "../scripts/lib/sqlite-tables.mjs";

test("FTS5's own shadow tables are shadow; a real table sharing the prefix is real", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE VIRTUAL TABLE search_prose USING fts5(body);" +
      "CREATE TABLE search_prose_notes (x);" +
      "CREATE TABLE posts (slug);",
  );
  const rows = /** @type {{ name: string, sql: string | null }[]} */ (
    db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all()
  );
  db.close();

  const classified = classifySqliteTables(rows);
  assert.deepEqual(classified.virtual, ["search_prose"]);
  // Whatever SQLite names them, every table it created for the index is recognised as shadow.
  const created = rows.map((r) => r.name).filter((n) => n.startsWith("search_prose_") && n !== "search_prose_notes");
  assert.ok(created.length >= 4, `FTS5 created ${created.length} shadow table(s)`);
  assert.deepEqual(classified.shadow, [...created].sort());
  assert.deepEqual(classified.real, ["posts", "search_prose_notes"]);
});
