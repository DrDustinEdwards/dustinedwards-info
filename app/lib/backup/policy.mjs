// PURE on purpose, like verdicts.mjs: check:tests cannot reach a module that imports a binding, and
// the rules that decide whether a dump may be marked complete must be provable by `node --test`.

/**
 * The D1 tables that are NOT derived from the repository or the bucket (hard rule 18), so the dump
 * is the only copy of their rows. Read off drizzle/*.sql on 2026-10-11; the reason names the source
 * of each. Every other table converges toward the repository or a bucket and is repaired through
 * its derivation, so its absence from a dump would cost a rebuild, not data.
 *
 * `settings` is not here: its one key, llms.txt, is derived from the repository by sync_llms.
 */
export const NON_DERIVED_TABLES = Object.freeze({
  webmentions: "rows came from strangers' POSTs and the moderation decisions on them (migration 0014)",
  zero_result_queries: "search demand signal, swept by retention, converges toward nothing (0015)",
  procedure_versions: "the sealed frozen copy of every published procedure version, never rewritten (0027)",
  kb_locations: "Knowledge Base inventory locations, written through site-api (0029)",
  kb_lots: "Knowledge Base inventory lots, written through site-api (0029)",
  kb_audit: "the audit trail of the two inventory tables (0029)",
  members: "lab members and their titles (0030)",
  member_audit: "the audit trail of membership changes (0030)",
  member_terms: "lab term end dates (0030)",
});

/** A dump that lacks any of these is not complete, whatever else it holds. */
export const REQUIRED_TABLES = Object.freeze(Object.keys(NON_DERIVED_TABLES));

/**
 * Tables left out of the dump because they hold live credentials or one-time tokens. EMPTY, and
 * deliberately so: no table in the current schema holds either. The Better Auth tables (user,
 * session, account, verification) were dropped by migration 0026, admin sign-in is Cloudflare
 * Access and keeps no row, and preview-link tokens live in KV (app/lib/preview-token.mjs), not D1.
 * A table added later that matches CREDENTIAL_COLUMN fails the dump by name until it is listed
 * here, with the reason, or its column is renamed.
 */
/** @type {readonly string[]} */
export const EXCLUDED_TABLES = Object.freeze(/** @type {string[]} */ ([]));

/** A column name that says it holds a credential. Matched case-insensitively, camelCase included. */
export const CREDENTIAL_COLUMN = /password|passwd|secret|token|api_?key|credential|private_?key/i;

/**
 * @param {string} sql a CREATE TABLE statement
 * @returns {string[]} the column names it declares
 */
export function columnNames(sql) {
  const open = sql.indexOf("(");
  const close = sql.lastIndexOf(")");
  if (open < 0 || close < open) return [];
  const body = sql.slice(open + 1, close);
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  const names = [];
  for (const part of parts) {
    const text = part.trim();
    if (!text || /^(constraint|primary|unique|foreign|check)\b/i.test(text)) continue;
    const match = /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|(\S+))/.exec(text);
    const name = match?.[1] ?? match?.[2] ?? match?.[3] ?? match?.[4];
    if (name) names.push(name);
  }
  return names;
}

/**
 * Every problem that stops a dump being marked complete, each naming the table. An empty list is
 * the only pass; the caller refuses the marker otherwise and throws, so the run stays incomplete.
 *
 * @param {{
 *   tables: Array<{ name: string, rows: number }>,
 *   excluded: string[],
 *   schema: Array<{ type: string, name: string, sql: string }>,
 * }} dump what dumpDatabase returned, and the CREATE statements of the database it read
 * @param {{ required?: readonly string[], allowedExcluded?: readonly string[] }} [policy]
 * @returns {string[]}
 */
export function dumpProblems(dump, policy = {}) {
  const required = policy.required ?? REQUIRED_TABLES;
  const allowedExcluded = policy.allowedExcluded ?? EXCLUDED_TABLES;
  const problems = [];

  const held = new Map(dump.tables.map((t) => [t.name, t.rows]));
  const total = [...held.values()].reduce((sum, rows) => sum + rows, 0);
  if (held.size === 0 || total === 0) {
    problems.push(`the dump holds no rows (${held.size} table(s), ${total} row(s)), which is what a wrong or emptied database looks like`);
  }

  for (const name of required) {
    if (!held.has(name)) problems.push(`required table ${name} is missing from the dump`);
  }

  for (const name of dump.excluded) {
    if (!allowedExcluded.includes(name)) problems.push(`table ${name} was excluded but is not on the excluded list, so its rows would be lost silently`);
  }

  for (const entry of dump.schema) {
    if (entry.type !== "table" || /^\s*CREATE\s+VIRTUAL/i.test(entry.sql)) continue;
    if (dump.excluded.includes(entry.name)) continue;
    if (!held.has(entry.name)) continue;
    const credential = columnNames(entry.sql).filter((c) => CREDENTIAL_COLUMN.test(c));
    if (credential.length > 0) {
      problems.push(`table ${entry.name} has credential-looking column(s) ${credential.join(", ")} and is in the dump; exclude it with a reason or rename the column`);
    }
  }
  return problems;
}
