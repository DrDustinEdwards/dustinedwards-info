/**
 * A SQL string literal, or NULL: the only escaping a statement written to a `--file` needs. Seeds
 * and syncs go through files, never a cmd command string, because cmd.exe quoting is not SQL quoting.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}
