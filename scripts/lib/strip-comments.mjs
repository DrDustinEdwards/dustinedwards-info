/**
 * A JavaScript tokenizer, so not for CSS, where `//` is never a comment, and it reads an
 * apostrophe in SVG text as opening a string.
 */

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
        if (source[j] === "\n") newlines += "\n";
        if (source[j] === quote) {
          j += 1;
          closed = true;
          break;
        }
        j += 1;
      }
      if (!closed) {
        out += source.slice(i);
        break;
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

    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
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
