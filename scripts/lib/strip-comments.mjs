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
 * ## THE GUARD ON LINE COMMENTS IS LOAD-BEARING
 *
 * A line comment is only stripped when the two slashes are NOT preceded by a
 * colon, so `https://developers.cloudflare.com` inside a string survives. That
 * guard is why this helper can be pointed at TypeScript full of URLs.
 *
 * It is also exactly why this helper HAS A BOUNDARY, below.
 *
 * ## NEVER FEED THIS JSONC OR SVG
 *
 * The colon guard protects `https://` and `xlink:href`. It cannot protect a
 * PROTOCOL-RELATIVE url, `"//cdn.example.com/x"`, whose slashes follow a quote.
 * In a .ts file that string is rare and a comment is common. In JSONC and SVG
 * the reverse is true, and eating one destroys the value and everything after
 * it on the line.
 *
 * MEASURED, 2026-08-23, on a fixture carrying one protocol-relative url:
 *
 *   - JSONC through this helper no longer parses. `JSON.parse` threw
 *     "Bad control character in string literal". Through the weak form it
 *     parsed and kept the url intact.
 *   - SVG through this helper lost the whole `xlink:href` VALUE and the rest
 *     of its line.
 *
 * The audit that prompted this consolidation said the hazard was the strong
 * form eating `xmlns:xlink="http://..."`. That is FALSE, and measurement is how
 * it was corrected: the colon guard protects exactly that case. The real hazard
 * is the protocol-relative url, which the audit's example would never have
 * shown. `test/strip-comments.test.mjs` asserts the boundary rather than
 * describing it, because a comment saying "do not do this" is not an
 * instrument.
 *
 * Weak strippers stay where they are, each with its reason written at its site:
 * three JSONC readers (`JSON.parse` throws on a surviving comment, so weak is
 * sufficient) and check:logo's SVG path.
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
  const collapsed = options.preserveLines
    ? source
        .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    : source
        .replace(/\/\*[\s\S]*?\*\//g, " ");
  return collapsed
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Comments out, STRING LITERALS BLANKED TO `""` as well.
 *
 * Two gates need this and both need it for the same reason: they search for
 * names that also appear inside ordinary strings. check:invariants quotes the
 * very patterns it hunts, so it would flag itself; check:secrets reads files
 * that name their own configuration flags in user-facing copy.
 *
 * ORDER MATTERS AND IS NOT A TIDINESS PREFERENCE. Comments must go first: an
 * apostrophe in prose ("doesn't", or a possessive in a docblock) opens a
 * single-quoted string as far as a regex is concerned and runs to the next
 * apostrophe anywhere in the file, swallowing the code between. check:invariants
 * section 5 reported `process.argv`, `window.innerHeight` and `Math.floor` as
 * unknown database columns for exactly this reason, before comments were
 * stripped first.
 *
 * ## THAT REASONING WAS RIGHT AND ITS FIX WAS HALF THE PROBLEM. 2026-08-26.
 *
 * Stripping comments first closes the apostrophe-in-PROSE case completely. The
 * identical failure through an apostrophe in a double-quoted STRING was left
 * open, because three independent passes cannot know that a quote is already
 * inside a literal opened by a different quote character.
 *
 * MEASURED on a two-call fixture whose labels were "the page's verdict" and
 * "the tile's age". The single-quote pass paired those two apostrophes and
 * blanked everything between them, so:
 *
 *     ok("the page's verdict", someNumber < LIMIT, "detail one");
 *     ok("the tile's age", otherNumber >= 0, "detail two");
 *
 * came out as ONE call reading `ok("""", otherNumber >= 0, "")`. Both
 * directions are wrong and the second is worse:
 *
 *   - FALSE POSITIVE: `""""` sits in the condition slot, so section 17 reports
 *     a string literal where the source has a boolean expression. That is how
 *     this was found.
 *   - FALSE NEGATIVE: the first call VANISHED from the scan entirely. An
 *     assertion inside a swallowed span is never examined, and `callsExamined`
 *     silently drops. A tokenizer that hides assertions from the gate whose
 *     whole subject is assertions that cannot fail is the vacuity class, in the
 *     instrument that enforces it.
 *
 * ONE LEFT-TO-RIGHT PASS, so whichever quote opens first owns the span until
 * its own match closes it. That is the only shape that can be right, because
 * "is this quote a delimiter" is a question about everything to its left.
 *
 * NEWLINES INSIDE A BLANKED STRING ARE KEPT, which the regex form did not do.
 * Section 17 reports a file and a LINE, and it computes that line from the
 * blanked text; a multi-line template collapsing to two characters moved every
 * line after it, which is why the failure that found this pointed at a line
 * holding something else entirely.
 *
 * REGEX LITERALS ARE STILL NOT UNDERSTOOD, exactly as before. A quote inside a
 * character class is read as a delimiter. That is unchanged, deliberately: the
 * distinction between division and a regex literal needs real parsing, no gate
 * has been bitten by it, and widening this beyond the measured defect is how a
 * helper that nine gates depend on acquires a new failure mode.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripCommentsAndStrings(source) {
  const code = stripComments(source);
  let out = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c !== '"' && c !== "'" && c !== "`") {
      out += c;
      i += 1;
      continue;
    }
    // A literal opens here. Walk to its own closing quote, honouring escapes,
    // and emit a pair of double quotes plus whatever newlines it spanned.
    const quote = c;
    let j = i + 1;
    let newlines = "";
    let closed = false;
    while (j < code.length) {
      const d = code[j];
      if (d === "\\") {
        j += 2;
        continue;
      }
      if (d === "\n") newlines += "\n";
      if (d === quote) {
        closed = true;
        j += 1;
        break;
      }
      j += 1;
    }
    /*
     * An UNTERMINATED literal is emitted verbatim rather than blanked to the
     * end of the file. A source that does not parse is a different problem, and
     * swallowing the remainder of the file is the failure this rewrite exists
     * to remove; leaving the text in place keeps the damage local and visible.
     */
    if (!closed) {
      out += code.slice(i);
      break;
    }
    out += `""${newlines}`;
    i = j;
  }
  return out;
}
