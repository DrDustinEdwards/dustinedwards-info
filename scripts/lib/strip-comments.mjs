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
 * @param {string} source
 * @returns {string}
 */
export function stripCommentsAndStrings(source) {
  return stripComments(source)
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}
