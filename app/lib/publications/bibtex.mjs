// The BibTeX text rules the site's three writers share (the publications export, the CV's publication entries and
// a procedure's citation), so none of them emits a field BibTeX cannot read.

import { decodeEntities } from "./entities.mjs";

/** @type {Record<string, string>} */
const BIBTEX_ESCAPES = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/**
 * Text for a braced field, with its HTML entities decoded and each character BibTeX or LaTeX reads as markup escaped.
 *
 * @param {string} value
 */
export function escapeBibtex(value) {
  // One pass: a replacement that carries braces (`\textbackslash{}`) must not meet the brace rule.
  return decodeEntities(value).replace(/[\\{}&%$#_~^]/g, (char) => BIBTEX_ESCAPES[char] ?? char);
}

/**
 * A page range, escaped, with every hyphen or dash run between its numbers as the `--` BibTeX styles expect.
 *
 * @param {string} pages
 */
export function bibtexPages(pages) {
  return escapeBibtex(pages).replace(/\s*[-‐-―]+\s*/g, "--");
}
