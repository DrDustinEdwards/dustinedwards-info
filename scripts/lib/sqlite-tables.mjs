/**
 * Classifying `sqlite_master` rows into virtual, shadow and real tables.
 *
 * ONE ENUMERATOR RULE, TWO SOURCES: three callers were applying the same classification
 * independently over rows read from a live database and from migrations replayed into memory. The
 * rules were already identical and the comments said so, but identical because two people wrote
 * them the same way is the shape this repo keeps converting into one module with several readers.
 * The classifier is source-agnostic: it takes rows, not a database.
 *
 * VIRTUAL: the DDL says so, never a name list, because the set has grown twice and a hardcoded
 * list is how the next one gets missed. SHADOW: the name is prefixed with a virtual table's name,
 * the per-index set differing by fts5 version, so the prefix is the durable rule. INTERNAL: the
 * reserved prefix SQLite keeps for its own bookkeeping.
 *
 * Platform bookkeeping is NOT handled here: it is a property of where the rows came from rather
 * than of SQLite, so it stays with the caller that reads a live database.
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
 * Every table name an FTS index owns, which is the set that must never be written to directly:
 * deleting from any of them corrupts the index and the repair is a rebuild. Counting rows in one
 * is equally wrong in the other direction, a count on an external-content index reading THROUGH to
 * the content table, which is why the health checks count the docsize shadow instead.
 *
 * @param {{ virtual: string[], shadow: string[] }} classified
 * @returns {string[]}
 */
export function ftsOwnedTables({ virtual, shadow }) {
  return [...virtual, ...shadow].sort();
}
