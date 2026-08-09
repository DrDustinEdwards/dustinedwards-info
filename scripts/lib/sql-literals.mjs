/**
 * Joining adjacent string literals across `+`, so a SQL statement split for
 * line length is one statement again.
 *
 * EXTRACTED from `check-invariants.mjs` 2026-08-09 so it can be tested without
 * importing that gate, which runs its whole suite at module load (esbuild plus
 * an in-memory SQLite) and cannot be imported for one function. Same
 * one-module-two-callers pattern the pipeline already uses for `records.mjs`,
 * `artifact.mjs` and `ask-keys.mjs`: the gate and the test import the same
 * code, so a test cannot pass against a copy of the rule.
 *
 * **This is what `sync-content.mjs` needed, and without it that file was the
 * last hole in section 5 of that gate.** It builds its SQL as literal text, so
 * the column names are all statically present, but it concatenates fragments:
 *
 *     `INSERT INTO posts (slug, kind, title, body, ` +
 *       `html, description, ...) VALUES (` +
 *       ...
 *
 * Every extraction in that section needs a WHOLE statement. The INSERT column
 * list is matched up to its closing paren, and that paren is three fragments
 * away, so the largest write path in the repo was invisible while the file
 * still appeared in the scan, because its single-fragment statements matched.
 * A gate that examines a file and misses its most important statement reports
 * the same "0 problems" as one that examined it properly.
 *
 * Joining is safe for the same reason it is necessary: it can only make a
 * literal LONGER, and a longer literal that is not SQL still fails the
 * `LOOKS_LIKE_SQL` test, while a name that resolves to no table is caught
 * either way.
 *
 * @param {string} source
 * @returns {string}
 */
export function joinConcatenatedLiterals(source) {
  let previous;
  let text = source;
  // Repeated because one pass leaves `a` + `b` + `c` half joined.
  do {
    previous = text;
    text = text.replace(/`\s*\+\s*`/g, "").replace(/'\s*\+\s*'/g, "");
  } while (text !== previous);
  return text;
}
