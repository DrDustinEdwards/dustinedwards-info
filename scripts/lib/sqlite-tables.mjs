/**
 * Classifying `sqlite_master` rows into virtual, shadow and real tables. ONE ENUMERATOR RULE, for
 * the callers that read a live database and the one that replays the migrations into memory.
 *
 * BOUNDARY: source-agnostic, so it takes rows rather than a database, and each class is derived
 * from the DDL or the naming rule rather than from a list. Platform bookkeeping is NOT handled
 * here, being a property of where the rows came from rather than of SQLite.
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
