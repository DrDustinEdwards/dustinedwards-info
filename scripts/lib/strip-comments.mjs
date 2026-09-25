/**
 * A JavaScript tokenizer, so not for CSS, where `//` is never a comment. An apostrophe in JSX or SVG
 * text is read as a string only when a matching quote closes it on the same line, which still
 * misreads two apostrophes on one line; `stripTsxComments` is the one for TSX, and for anything
 * that must be exact, read the syntax tree (scripts/lib/syntax.mjs).
 */

import { createRequire } from "node:module";

/**
 * One left-to-right pass: "is this a comment opener" depends on everything to its left, which no
 * set of independent regex passes can answer. A slash opens a regex when the previous significant
 * character cannot end an expression (the standard heuristic, not a parser).
 *
 * @param {string} source
 * @param {{ preserveLines?: boolean, blankStrings?: boolean }} options
 * @returns {string}
 */
function scan(source, options) {
  const preserveLines = options.preserveLines === true;
  const blankStrings = options.blankStrings === true;
  let out = "";
  let i = 0;

  const lastSignificant = () => {
    for (let k = out.length - 1; k >= 0; k -= 1) {
      if (!/\s/.test(out[k])) return out[k];
    }
    return "";
  };

  const opensRegex = () => {
    const prev = lastSignificant();
    if (prev === "") return true;
    return "(,=:[!&|?{};+-*%~^<>".includes(prev);
  };

  while (i < source.length) {
    const c = source[i];

    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      let newlines = "";
      let closed = false;
      while (j < source.length) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        // Only a template literal spans lines. A quote whose line ends first was never a string (an
        // apostrophe in JSX text, say), and reading it as one hid everything after it.
        if (source[j] === "\n") {
          if (quote !== "`") break;
          newlines += "\n";
        }
        if (source[j] === quote) {
          j += 1;
          closed = true;
          break;
        }
        j += 1;
      }
      if (!closed) {
        // Kept as a plain character and scanning goes on, so the comments after it are still stripped.
        out += c;
        i += 1;
        continue;
      }
      // Keep the newlines a string spanned: readers compute line numbers from this text.
      out += blankStrings ? `""${newlines}` : source.slice(i, j);
      i = j;
      continue;
    }

    if (c === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && opensRegex()) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < source.length) {
        const d = source[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        // A regex literal cannot span a newline, so this was a division after all.
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) {
          j += 1;
          closed = true;
          break;
        }
        j += 1;
      }
      if (closed) {
        out += source.slice(i, j);
        i = j;
        continue;
      }
    }

    // An opener with no closer (a glob like `src/**/x` in JSX text) is not a comment: swallowing the
    // rest of the file would hand every scan an empty tail to agree with.
    if (c === "/" && source[i + 1] === "*" && source.indexOf("*/", i + 2) !== -1) {
      const end = source.indexOf("*/", i + 2);
      const stop = end + 2;
      const span = source.slice(i, stop);
      out += preserveLines ? "\n".repeat((span.match(/\n/g) ?? []).length) : " ";
      i = stop;
      continue;
    }

    // No colon guard needed: strings are consumed whole above, so a `//` reaching here is in code.
    if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      out += " ";
      i = end === -1 ? source.length : end;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

/**
 * `preserveLines` replaces a block comment with the newlines it spanned, so reported line numbers
 * do not shift.
 *
 * @param {string} source
 * @param {{ preserveLines?: boolean }} [options]
 * @returns {string}
 */
export function stripComments(source, options = {}) {
  return scan(source, { preserveLines: options.preserveLines === true });
}

/**
 * @param {string} source
 * @returns {string}
 */
export function stripCommentsAndStrings(source) {
  return scan(source, { blankStrings: true });
}

/**
 * Comments out of TSX by the TypeScript parser, not the tokenizer above, which reads an apostrophe in
 * JSX text (`a post's table`) as opening a string and can then keep every comment after it. Each
 * comment is blanked to spaces with its newlines kept, so line numbers do not shift. JSX text is
 * never read as trivia, so `// not a comment` inside markup survives as the text it is.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripTsxComments(source) {
  const ts = createRequire(import.meta.url)("typescript");
  const file = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  /** @type {Array<[number, number]>} */
  const ranges = [];
  /** Where JSX text begins: content, not trivia, so never scanned for comments. */
  const textStarts = new Set();
  const findText = (/** @type {any} */ node) => {
    if (node.kind === ts.SyntaxKind.JsxText) textStarts.add(node.pos);
    for (const child of node.getChildren(file)) findText(child);
  };
  findText(file);
  const collect = (/** @type {number} */ pos) => {
    if (textStarts.has(pos)) return;
    for (const r of ts.getLeadingCommentRanges(source, pos) ?? []) ranges.push([r.pos, r.end]);
    for (const r of ts.getTrailingCommentRanges(source, pos) ?? []) ranges.push([r.pos, r.end]);
  };
  const visit = (/** @type {any} */ node) => {
    if (node.kind === ts.SyntaxKind.JsxText) return;
    collect(node.pos);
    collect(node.end);
    for (const child of node.getChildren(file)) visit(child);
  };
  visit(file);
  collect(file.endOfFileToken.pos);

  const out = source.split("");
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i += 1) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  }
  return out.join("");
}
