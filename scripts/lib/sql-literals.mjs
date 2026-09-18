/**
 * Joining adjacent string literals across `+`, so a SQL statement split for line length is one
 * statement again.
 *
 * EXTRACTED so it can be tested without importing the gate, which runs its whole suite at module
 * load and cannot be imported for one function. The gate and the test import the same code, so a
 * test cannot pass against a copy of the rule.
 *
 * **This is what the sync script needed, and without it that file was the last hole in the section
 * that reads write paths.** It builds its SQL as literal text but concatenates fragments, and
 * every extraction in that section needs a WHOLE statement: the INSERT column list is matched up
 * to its closing paren and that paren is several fragments away, so the largest write path in the
 * repo was invisible while the file still appeared in the scan.
 *
 * Joining is safe for the same reason it is necessary: it can only make a literal LONGER, and a
 * longer literal that is not SQL still fails the looks-like-SQL test.
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
