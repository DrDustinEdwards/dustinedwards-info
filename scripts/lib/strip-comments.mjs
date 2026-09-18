/**
 * THE JS-SCAN COMMENT STRIPPER, in one place: stripping comments before matching is hard rule 10's
 * discipline, and it was implemented nine times before this.
 *
 * BOUNDARY: it is a JAVASCRIPT TOKENIZER, so it reads an apostrophe in SVG text as opening a
 * string and a slash after an operator as opening a regex, and the CSS readers, where `//` is
 * never a comment, are not this job. A boundary note is a claim that ages, per hard rule 7, and
 * this one already aged once, in the commit that turned a regex into a tokenizer.
 *
 * @see test/strip-comments.test.mjs
 */

/**
 * ONE LEFT-TO-RIGHT PASS, and both exported functions are it.
 *
 * WHY ONE PASS: "is this a comment opener" is a question about everything to its left, and no
 * number of independent regex passes can answer it. This module learned that twice, once when
 * apostrophes inside double-quoted labels paired up, and once when a slash-star inside a string
 * opened a comment running to the next star-slash anywhere in the file. THE DIFFERENTIAL IS WHAT
 * SAID SO the second time: the string-blanking wrapper ran its own tokenizer, which does not
 * understand REGEX LITERALS.
 *
 * A slash opens a regex when the previous significant character cannot END an expression, the
 * standard heuristic rather than a parser, **adopted on a MEASUREMENT rather than on the
 * argument**: without it, one gate's own regex hid six assertion calls. An UNTERMINATED literal is
 * emitted verbatim to the end of the file rather than swallowing it.
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

  /** The last non-whitespace character EMITTED, which is what decides a slash. */
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

    /* A STRING LITERAL. Nothing inside it can open a comment or a regex. */
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
      /*
       * BLANKED TO TWO CHARACTERS PLUS THE NEWLINES IT SPANNED: a reader computes a LINE from this
       * text, and a collapsing multi-line template moved every line after it.
       */
      out += blankStrings ? `""${newlines}` : source.slice(i, j);
      i = j;
      continue;
    }

    /* A REGEX LITERAL, copied whole, character classes honoured. */
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
        // A newline cannot appear in a regex literal, so the heuristic was
        // wrong and this was a division. Fall through.
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

    /* A block comment. A space, or the newlines it spanned. */
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      const span = source.slice(i, stop);
      out += preserveLines ? "\n".repeat((span.match(/\n/g) ?? []).length) : " ";
      i = stop;
      continue;
    }

    /*
     * A line comment. The colon guard is GONE and is not needed: a string is consumed whole by the
     * branch above, so a `//` reaching here is in code.
     */
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
 * Comments out, strings kept. `preserveLines` replaces a block comment with the NEWLINES IT
 * SPANNED, so a multi-line anchor still matches and reported line numbers do not shift.
 *
 * @param {string} source
 * @param {{ preserveLines?: boolean }} [options]
 * @returns {string}
 */
export function stripComments(source, options = {}) {
  return scan(source, { preserveLines: options.preserveLines === true });
}

/**
 * Comments out, STRING LITERALS BLANKED as well. Two gates need this and both for the same
 * reason: they search for names that also appear inside ordinary strings. The same tokenizer, with
 * the strings blanked; it used to be a separate implementation that ran AFTER the stripper, which
 * is how the two disagreed about regex literals.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripCommentsAndStrings(source) {
  return scan(source, { blankStrings: true });
}
