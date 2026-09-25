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

  // The suffixes FTS3/4/5 give their shadow tables. Any `${v}_` prefix took a real table that merely
  // began with a virtual table's name (`search_prose_notes`) out of the real set.
  const SHADOW_SUFFIXES = ["data", "idx", "content", "docsize", "config", "segments", "segdir", "stat"];
  /** @param {string} name */
  const isShadow = (name) =>
    virtual.some((v) => SHADOW_SUFFIXES.some((suffix) => name === `${v}_${suffix}`));
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
