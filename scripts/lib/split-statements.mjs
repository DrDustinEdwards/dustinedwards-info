// D1 refuses one SQL statement over 100 KB (SQLITE_TOOBIG); bound parameters do not count, literals do.
// Two things write rows as literal INSERTs: `wrangler d1 export` (the backup, loaded back by the restore
// drill and RUNBOOK 4b) and scripts/sync-content.mjs. Both pass their SQL through here, so a row of any size
// is written as a small INSERT plus UPDATEs that append the rest of each long text column.

/** D1's cap on one statement, in bytes. */
export const D1_STATEMENT_LIMIT = 100_000;

/** A statement over this is rewritten. Well under the cap, so a small error in the estimate cannot reach it. */
const REWRITE_ABOVE = 80_000;

/** The most text one piece carries, in bytes once escaped. Several long columns still fit one INSERT. */
const PIECE_BYTES = 16_000;

/** @param {string} text */
const bytes = (text) => Buffer.byteLength(text, "utf8");

/**
 * Splits a SQL file into statements at the semicolons outside quotes and comments. A statement comes back
 * without its semicolon; blank ones are dropped.
 *
 * @param {string} sql
 * @returns {string[]}
 */
export function splitStatements(sql) {
  /** @type {string[]} */
  const out = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === "`") {
      i = endOfQuoted(sql, i);
    } else if (c === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
    } else if (c === "/" && sql[i + 1] === "*") {
      const close = sql.indexOf("*/", i + 2);
      i = close === -1 ? sql.length : close + 2;
    } else if (c === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement !== "") out.push(statement);
      start = i + 1;
      i += 1;
    } else {
      i += 1;
    }
  }
  const rest = sql.slice(start).trim();
  if (rest !== "") out.push(rest);
  return out;
}

/**
 * The index just past the closing quote of the quoted run starting at `at`; a doubled quote is an escape.
 * @param {string} text @param {number} at
 */
function endOfQuoted(text, at) {
  const quote = text[at];
  let i = at + 1;
  while (i < text.length) {
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  throw new Error(`unterminated ${quote} quote in SQL`);
}

/**
 * Splits `text` at the top-level occurrences of `separator` (outside quotes and parentheses).
 * @param {string} text @param {string} separator
 * @returns {string[]}
 */
function splitTopLevel(text, separator) {
  /** @type {string[]} */
  const out = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"' || c === "`") {
      i = endOfQuoted(text, i);
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if (depth === 0 && text.startsWith(separator, i)) {
      out.push(text.slice(start, i));
      i += separator.length;
      start = i;
      continue;
    }
    i += 1;
  }
  out.push(text.slice(start));
  return out;
}

/** @param {string} name a bare, "quoted", `quoted` or [quoted] identifier */
function unquoteIdentifier(name) {
  const t = name.trim();
  if (t.startsWith('"')) return t.slice(1, -1).replace(/""/g, '"');
  if (t.startsWith("`")) return t.slice(1, -1).replace(/``/g, "`");
  if (t.startsWith("[")) return t.slice(1, -1);
  return t;
}

/** @param {string} name */
const quoteIdentifier = (name) => `"${name.replace(/"/g, '""')}"`;

/** @param {string} text */
const quoteLiteral = (text) => `'${text.replace(/'/g, "''")}'`;

const STRING_LITERAL = /^'(?:[^']|'')*'$/;

/**
 * One long value as pieces whose concatenation is the value. A value is string literals and anything else
 * (`char(10)`, a call) joined by `||`; a literal is cut between code points, anything else must fit whole.
 *
 * @param {string} expression
 * @returns {string[]} SQL expressions, each small
 */
function pieces(expression) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  let current = [];
  let size = 0;
  const flush = () => {
    if (current.length > 0) out.push(current.join("||"));
    current = [];
    size = 0;
  };
  /** @param {string} term */
  const add = (term) => {
    const cost = bytes(term) + 2;
    if (size + cost > PIECE_BYTES) flush();
    current.push(term);
    size += cost;
  };

  for (const raw of splitTopLevel(expression, "||")) {
    const term = raw.trim();
    if (!STRING_LITERAL.test(term)) {
      if (bytes(term) > PIECE_BYTES) {
        throw new Error(
          `a ${bytes(term)}-byte value is not a plain string literal, so it cannot be cut into pieces: ${term.slice(0, 60)}...`,
        );
      }
      add(term);
      continue;
    }
    const text = term.slice(1, -1).replace(/''/g, "'");
    let run = "";
    let runBytes = 2;
    for (const ch of text) {
      const cost = ch === "'" ? 2 : bytes(ch);
      if (size + runBytes + cost > PIECE_BYTES && run !== "") {
        add(quoteLiteral(run));
        flush();
        run = "";
        runBytes = 2;
      }
      run += ch;
      runBytes += cost;
    }
    if (run !== "" || text === "") add(quoteLiteral(run));
  }
  flush();
  return out.length > 0 ? out : ["''"];
}

const INSERT_HEAD =
  /^INSERT\s+INTO\s+("(?:[^"]|"")+"|`[^`]+`|\[[^\]]+\]|\w+)\s*(?:\(([^)]*)\))?\s*VALUES\s*\(/i;

/**
 * @typedef {object} SplitOptions
 * @property {(table: string) => string[] | undefined} [columnsOf] a table's columns in order, for an INSERT that does not list them
 * @property {(table: string) => string[] | undefined} [keyOf] a table's primary key, for an INSERT with no ON CONFLICT target; without one the new row is addressed as last_insert_rowid()
 * @property {string[]} [lateColumns] columns a split row is written with blank and given their real value in the last statement, so a run that stops half way leaves a row that reads as not current instead of a truncated one that claims to match its file
 */

/**
 * Rewrites every statement over D1's cap. An INSERT (or upsert) becomes the INSERT with the first piece of
 * each long column, then one `UPDATE ... SET col = col || piece` per remaining piece, addressed by the row's
 * key. A statement under the line passes through byte for byte. Anything over the line that this cannot cut
 * (not an INSERT, a long value that is not a string, a key column that is itself long) throws, so a restore
 * or a sync stops here and names the statement instead of D1 refusing it with SQLITE_TOOBIG.
 *
 * @param {string} sql
 * @param {SplitOptions} [options]
 * @returns {string} the file's SQL, a statement per line group
 */
export function splitOversizeStatements(sql, options = {}) {
  /** @type {string[]} */
  const out = [];
  for (const statement of splitStatements(sql)) {
    if (bytes(statement) <= REWRITE_ABOVE) {
      out.push(`${statement};`);
      continue;
    }
    for (const part of splitInsert(statement, options)) {
      if (bytes(part) >= D1_STATEMENT_LIMIT) {
        throw new Error(
          `a ${bytes(part)}-byte statement is still over D1's ${D1_STATEMENT_LIMIT}-byte cap after splitting: ${part.slice(0, 80)}...`,
        );
      }
      out.push(`${part};`);
    }
  }
  return `${out.join("\n")}\n`;
}

/**
 * @param {string} statement one oversize statement, without its semicolon
 * @param {SplitOptions} options
 * @returns {string[]}
 */
function splitInsert(statement, options) {
  const head = INSERT_HEAD.exec(statement);
  if (!head) {
    throw new Error(
      `a ${bytes(statement)}-byte statement is over D1's ${D1_STATEMENT_LIMIT}-byte cap and is not a plain INSERT, ` +
        `so it cannot be split: ${statement.slice(0, 80)}...`,
    );
  }
  const table = unquoteIdentifier(head[1]);

  /* The matching close paren of VALUES(, then whatever follows (ON CONFLICT ...). */
  let depth = 1;
  let i = head[0].length;
  while (i < statement.length && depth > 0) {
    const c = statement[i];
    if (c === "'" || c === '"' || c === "`") {
      i = endOfQuoted(statement, i);
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error(`unbalanced parentheses in an INSERT into ${table}`);
  const valuesText = statement.slice(head[0].length, i - 1);
  const tail = statement.slice(i).trim();
  const values = splitTopLevel(valuesText, ",").map((v) => v.trim());

  const columns = head[2] ? head[2].split(",").map(unquoteIdentifier) : options.columnsOf?.(table);
  if (!columns) {
    throw new Error(`an oversize INSERT into ${table} lists no columns and none were given for it`);
  }
  if (columns.length !== values.length) {
    throw new Error(`an INSERT into ${table} names ${columns.length} columns but has ${values.length} values`);
  }

  const conflict = /^ON\s+CONFLICT\s*\(([^)]*)\)/i.exec(tail);
  const keyColumns = conflict ? conflict[1].split(",").map(unquoteIdentifier) : options.keyOf?.(table);
  /** @type {string} */
  let where;
  if (keyColumns && keyColumns.length > 0) {
    where = keyColumns
      .map((k) => {
        const at = columns.indexOf(k);
        if (at === -1) throw new Error(`the key column ${k} of ${table} is not among the INSERT's columns`);
        if (bytes(values[at]) > PIECE_BYTES) throw new Error(`the key column ${k} of ${table} is itself long`);
        return `${quoteIdentifier(k)} = ${values[at]}`;
      })
      .join(" AND ");
  } else {
    where = "rowid = last_insert_rowid()";
  }

  const late = (options.lateColumns ?? []).filter((c) => columns.includes(c));
  /** @type {string[]} */
  const later = [];
  /** @type {string[]} */
  const first = [];
  /** @type {string[]} */
  const appends = [];
  values.forEach((value, at) => {
    const column = columns[at];
    if (late.includes(column)) {
      first.push("''");
      later.push(`${quoteIdentifier(column)} = ${value}`);
      return;
    }
    if (bytes(value) <= PIECE_BYTES) {
      first.push(value);
      return;
    }
    const [head1, ...rest] = pieces(value);
    first.push(head1);
    for (const piece of rest) {
      appends.push(`UPDATE ${quoteIdentifier(table)} SET ${quoteIdentifier(column)} = ${quoteIdentifier(column)} || ${piece} WHERE ${where}`);
    }
  });

  /* The key was read from the original values above; a late column that is the key would be blanked. */
  if (keyColumns?.some((k) => late.includes(k))) throw new Error(`${table}: a key column cannot be a late column`);

  const insert =
    `INSERT INTO ${head[1]} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${first.join(", ")})` +
    (tail ? ` ${tail}` : "");
  const finish = later.length > 0 ? [`UPDATE ${quoteIdentifier(table)} SET ${later.join(", ")} WHERE ${where}`] : [];
  return [insert, ...appends, ...finish];
}
