/**
 * Joining adjacent string literals across `+`, so a SQL statement split for line length is one
 * statement again and an extractor that needs a WHOLE statement can see it.
 *
 * BOUNDARY: joining can only make a literal LONGER, so a longer literal that is not SQL still
 * fails its reader's own looks-like-SQL test. Extracted so it can be tested without importing the
 * gate, which runs its whole suite at module load.
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
