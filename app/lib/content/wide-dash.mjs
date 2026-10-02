// The house style's no-wide-dash rule, as one function: the content pipeline, the CV validator and the page
// compile all hold text to it. Dependency-free on purpose, so a validator can import it without the renderer.

// Escapes, so this file stays clean under the no-em-dash rule. U+2010 to U+2015 plus U+2212.
const WIDE_DASH = /[\u2010-\u2015\u2212]/g;

/**
 * Server-side half of the no-em-dash rule: a commit through the GitHub API never meets the local hook.
 *
 * @param {string} text
 * @returns {Array<{ line: number, column: number, char: string, excerpt: string }>}
 */
export function findWideDashes(text) {
  /** @type {Array<{ line: number, column: number, char: string, excerpt: string }>} */
  const hits = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    WIDE_DASH.lastIndex = 0;
    let match;
    while ((match = WIDE_DASH.exec(line)) !== null) {
      hits.push({
        line: i + 1,
        column: match.index + 1,
        char: `U+${match[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`,
        excerpt: line.slice(Math.max(0, match.index - 30), match.index + 30).trim(),
      });
    }
  });
  return hits;
}
