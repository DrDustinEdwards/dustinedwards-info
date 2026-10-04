// What splitOversizeStatements needs to know about a table that the dump does not say: its columns, in order,
// and its primary key. Read by applying drizzle/ to an in-memory SQLite, so it needs no database and cannot
// disagree with the migrations the restore builds its schema from.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * @param {string} [dir]
 * @returns {{ columnsOf: (table: string) => string[] | undefined, keyOf: (table: string) => string[] | undefined }}
 */
export function migrationSchema(dir = "drizzle") {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      db.exec(readFileSync(path.join(dir, file), "utf8"));
    }
    const rows = /** @type {Array<{ t: string, c: string, pk: number }>} */ (
      db
        .prepare(
          "SELECT m.name AS t, p.name AS c, p.pk AS pk FROM sqlite_master m, pragma_table_info(m.name) p " +
            "WHERE m.type = 'table' ORDER BY m.name, p.cid",
        )
        .all()
    );
    /** @type {Map<string, string[]>} */
    const columns = new Map();
    /** @type {Map<string, Array<{ c: string, pk: number }>>} */
    const keys = new Map();
    for (const row of rows) {
      columns.set(row.t, [...(columns.get(row.t) ?? []), row.c]);
      if (row.pk > 0) keys.set(row.t, [...(keys.get(row.t) ?? []), { c: row.c, pk: row.pk }]);
    }
    return {
      columnsOf: (table) => columns.get(table),
      keyOf: (table) => keys.get(table)?.sort((a, b) => a.pk - b.pk).map((k) => k.c),
    };
  } finally {
    db.close();
  }
}
