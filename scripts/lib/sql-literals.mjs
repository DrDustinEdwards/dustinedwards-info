/**
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
