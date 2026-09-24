/**
 * Platform bookkeeping tables are not handled here: they are a property of where the rows came
 * from, not of SQLite.
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
 * Never written directly: deleting from any of them corrupts the index. Never counted either: a
 * count on an external-content index reads through to the content table.
 *
 * @param {{ virtual: string[], shadow: string[] }} classified
 * @returns {string[]}
 */
export function ftsOwnedTables({ virtual, shadow }) {
  return [...virtual, ...shadow].sort();
}
