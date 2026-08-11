/**
 * Classifying `sqlite_master` rows into virtual, shadow and real tables.
 *
 * ONE ENUMERATOR RULE, TWO SOURCES. Extracted 2026-08-10 because three callers
 * were applying the same classification independently:
 *
 *   check-backup.mjs      rows read from the LIVE database over wrangler
 *   check-invariants.mjs  rows read from the migrations replayed into :memory:
 *   check-invariants.mjs  section 7, the same, for the FTS delete scan
 *
 * The rules were already identical and the comments in both files said so, but
 * "identical because two people wrote them the same way" is exactly the shape
 * this repo keeps converting into one module with several readers. The
 * classifier is source-agnostic: it takes rows, not a database.
 *
 * ## The rules, and why each is derived rather than named
 *
 * VIRTUAL: the DDL says `CREATE VIRTUAL TABLE`. Never a name list, because
 * `posts_fts`, `search_identity` and `search_prose` were one, then two, then
 * three, and a hardcoded list is how the next one gets missed.
 *
 * SHADOW: the name is prefixed with a virtual table's name and an underscore.
 * fts5 creates `_data`, `_idx`, `_content`, `_docsize` and `_config` per index,
 * and the set differs by fts5 version, so the prefix is the durable rule and a
 * suffix list is not.
 *
 * INTERNAL: `sqlite_%`, reserved by SQLite for its own bookkeeping.
 *
 * Platform bookkeeping (`_cf_KV`, `d1_migrations`, `_cf_METADATA`) is NOT
 * handled here. It is a property of where the rows came from, not of SQLite, so
 * it stays with the caller that reads a live D1.
 *
 * @param {{ name: string, sql: string | null }[]} rows
 * @returns {{ virtual: string[], shadow: string[], real: string[] }}
 */
export function classifySqliteTables(rows) {
  const virtual = rows
    .filter((r) => /CREATE\s+VIRTUAL\s+TABLE/i.test(r.sql ?? ""))
    .map((r) => r.name);

  /** @param {string} name */
  const isShadow = (name) => virtual.some((v) => name !== v && name.startsWith(`${v}_`));
  /** @param {string} name */
  const isInternal = (name) => name.toLowerCase().startsWith("sqlite_");

  return {
    virtual: [...virtual].sort(),
    shadow: rows
      .map((r) => r.name)
      .filter((n) => !virtual.includes(n) && isShadow(n))
      .sort(),
    real: rows
      .map((r) => r.name)
      .filter((n) => !virtual.includes(n) && !isShadow(n) && !isInternal(n))
      .sort(),
  };
}

/**
 * Every table name an FTS index owns: the index itself plus its shadow tables.
 *
 * This is the set that must never be written to directly. `DELETE FROM` any of
 * them corrupts the index, and the repair is
 * `INSERT INTO <index>(<index>) VALUES('rebuild')`. Counting rows in one is
 * equally wrong in the other direction: `COUNT(*)` on an external-content index
 * reads THROUGH to the content table and can never detect drift, which is why
 * the health checks count `*_docsize` instead.
 *
 * @param {{ virtual: string[], shadow: string[] }} classified
 * @returns {string[]}
 */
export function ftsOwnedTables({ virtual, shadow }) {
  return [...virtual, ...shadow].sort();
}
