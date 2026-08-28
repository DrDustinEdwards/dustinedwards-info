/**
 * THE JS-SCAN COMMENT STRIPPER, in one place.
 *
 * ## What this is for, and the trap every gate here has hit
 *
 * A gate that searches source for a literal will find that literal in the PROSE
 * explaining why it is forbidden. check:logo, check:contrast, check:features,
 * check:headers, check:urls and check:secrets have each hit this, and one of
 * them passed every row for the wrong reason. Stripping comments before
 * matching is hard rule 10's discipline, and it was implemented nine times.
 *
 * Nine copies of one job can drift in STRENGTH, which is the whole risk: a copy
 * that is weaker than its siblings does not fail, it passes for a reason nobody
 * checks.
 *
 * ## IT IS A TOKENIZER, SINCE 2026-08-28, AND THE OLD BOUNDARY MOVED WITH IT
 *
 * This removed comments with a regex and carried a colon guard on line
 * comments, so `https://` inside a string was not read as one. That guard was
 * load-bearing and it was also the shape of the boundary: it could not protect
 * a PROTOCOL-RELATIVE url, `"//cdn.example.com/x"`, whose slashes follow a
 * quote. Feeding this JSONC or SVG destroyed the value and the rest of its
 * line, measured on 2026-08-23 and asserted in the tests.
 *
 * **THAT IS NO LONGER TRUE, AND THE TESTS NOW ASSERT THE OPPOSITE.** A string
 * literal is consumed whole before any slash inside it is considered, so the
 * colon guard is gone because nothing needs it: a `//` reaching the comment
 * branch is in code. MEASURED 2026-08-28: the JSONC fixture parses and keeps
 * its url, and the SVG fixture keeps its href and the rest of the line.
 *
 * A boundary note is a claim that ages, per hard rule 7, and this one aged in
 * the commit that changed the mechanism under it.
 *
 * ## THE WEAK FORMS STAY ANYWAY, on a narrower argument
 *
 * Three JSONC readers and check:logo's SVG path keep their own weak strippers.
 * The measured hazard is gone, so what is left is that THIS IS A JAVASCRIPT
 * TOKENIZER: it reads an apostrophe in SVG text content as opening a string,
 * and a slash after an operator-looking character as opening a regex, neither
 * of which means anything in those formats. On today's fixtures neither costs
 * anything, so moving a weak reader onto this one is a decision that needs a
 * measurement rather than a tidy-up.
 *
 * ## JOBS THAT ARE NOT THIS JOB
 *
 * `app/lib/media/template-refs.mjs` is string-aware; `check-urls.mjs` strips
 * blocks only, on purpose, because it needs `//host` inside strings to survive;
 * `check-contrast.mjs` and `scripts/lib/tokens.mjs` are CSS, where `//` is
 * never a comment. Unifying different jobs is the wrong cut and is not done
 * here.
 *
 * @see test/strip-comments.test.mjs
 */

/**
 * ONE LEFT-TO-RIGHT PASS, and both exported functions are it.
 *
 * ## WHY ONE PASS, TWICE OVER
 *
 * "Is this a comment opener" is a question about everything to its left, and no
 * number of independent regex passes can answer it. This module learned that
 * twice before it learned it properly:
 *
 *   2026-08-26  `stripCommentsAndStrings` blanked strings in three regex passes,
 *               so two apostrophes inside DOUBLE-quoted labels paired up and the
 *               single-quote pass swallowed the lines between them. Fixed with a
 *               one-pass tokenizer, in that function alone.
 *   2026-08-28  `stripComments` still removed comments with a regex, so a `/`
 *               followed by a star INSIDE a string opened a comment running to
 *               the next star-slash anywhere in the file. Measured at HEAD: 347
 *               string literals across 37 files carry one of those sequences.
 *
 * The second fix could not live in `stripComments` alone, and the differential
 * is what said so. `stripCommentsAndStrings` calls it and then ran its OWN
 * string tokenizer, which does not understand REGEX LITERALS: once comments
 * stopped mangling them, quotes inside character classes survived into the
 * second pass and mispaired there. So there is one tokenizer now, and blanking
 * strings is a flag on it.
 *
 * ## WHAT IT UNDERSTANDS
 *
 * String literals in all three quotes, escapes honoured. Block and line
 * comments. Regex literals, including a slash inside a character class, which
 * `/[/]/` legally contains.
 *
 * A `/` opens a regex when the previous significant character cannot END an
 * expression. That is the standard heuristic rather than a parser, and it is
 * wrong only for a division whose left operand ends in an operator, which is
 * not a thing valid code does. **It was adopted on a MEASUREMENT rather than on
 * the argument:** without it, `check-llms.mjs` line 97, `/...["']...["']/`, hid
 * six assertion calls from `check:invariants` section 17, in the gate that
 * exists to catch invisible assertions.
 *
 * An UNTERMINATED literal of any kind is emitted verbatim to the end of the
 * file rather than swallowing it. A source that does not parse is a different
 * problem, and eating the remainder is the failure this module exists to
 * remove.
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
       * BLANKED TO `""` PLUS THE NEWLINES IT SPANNED. Section 17 reports a file
       * and a LINE computed from this text, and a multi-line template
       * collapsing to two characters moved every line after it.
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
     * A line comment. The colon guard is GONE and is not needed: it existed so
     * a `https://` inside a string was not read as a comment, and a string is
     * consumed whole by the branch above. A `//` reaching here is in code.
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
 * Comments out, strings kept.
 *
 * `preserveLines` replaces a block comment with the NEWLINES IT SPANNED rather
 * than a space, so a multi-line anchor still matches across code that had a
 * comment between its lines and reported line numbers do not shift.
 * check:assertions learned that the expensive way when collapsing comments
 * moved every line it reported.
 *
 * @param {string} source
 * @param {{ preserveLines?: boolean }} [options]
 * @returns {string}
 */
export function stripComments(source, options = {}) {
  return scan(source, { preserveLines: options.preserveLines === true });
}

/**
 * Comments out, STRING LITERALS BLANKED TO `""` as well.
 *
 * Two gates need this and both need it for the same reason: they search for
 * names that also appear inside ordinary strings. check:invariants quotes the
 * very patterns it hunts, so it would flag itself; check:secrets reads files
 * that name their own configuration flags in user-facing copy.
 *
 * The same tokenizer, with the strings blanked instead of copied. It used to be
 * a separate implementation that ran AFTER `stripComments`, which is how the
 * two disagreed about regex literals; the header on `scan` records what that
 * cost and how it was measured.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripCommentsAndStrings(source) {
  return scan(source, { blankStrings: true });
}
