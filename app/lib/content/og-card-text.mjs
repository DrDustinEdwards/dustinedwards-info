/**
 * How the social card's TEXT is fitted: which size the title takes, and where
 * the title and the description are cut.
 *
 * ## Why this is its own module rather than three helpers inside `build-og.mjs`
 *
 * TWO READERS, and the second one is the reason. `build-og.mjs` draws the card;
 * `ogImageKey` in `pipeline.mjs` hashes what the card DRAWS, so it has to be
 * able to ask for the same clamped strings the template will paint. When the
 * clamp lived inside the template, the key hashed the full description while
 * the card drew a cut one, which is the exact drift `ogImageKey`'s own docblock
 * records paying for twice: a value hashed and not drawn, and a value drawn and
 * not hashed.
 *
 * Being importable is also what makes it TESTABLE. `build-og.mjs` reaches R2
 * and shells out to wrangler at module scope; nothing in `test/` can import it.
 * This file imports nothing at all.
 *
 * ## CHARACTERS ARE AN APPROXIMATION OF A WIDTH, and it is stated rather than
 * hidden
 *
 * satori lays the card out by measuring glyphs; everything here counts
 * characters. The two agree closely for ordinary prose in mixed case and come
 * apart at the edges, which is the same honest limit the previous template's
 * 110-character cap wrote down: a synthetic string of capital Ws fills the
 * measure far sooner than the count suggests, and an unbroken word wider than
 * the measure runs off the edge, because satori has no word-break. The
 * breakpoints below are therefore set from RENDERED cards with headroom, not
 * from a width calculation.
 *
 * @see test/og-card-text.test.mjs
 * @see scripts/build-og.mjs for the layout these numbers were measured against
 */

/**
 * The largest title the card will draw, in characters.
 *
 * Past this the title is cut on a word boundary with an ellipsis. It is the
 * last ladder rung's own bound, so the smallest type is also the longest text,
 * and no title can be both too long for the ladder and unclamped.
 */
export const TITLE_MAX = 150;

/**
 * The type ladder, largest first: the longest title that still takes this size.
 *
 * MEASURED off rendered 1200x630 cards on 2026-08-30, against the layout in
 * `build-og.mjs` (a 1056px measure, the mark above, and the rule, description
 * and meta line below). Each rung is the length at which the title would
 * otherwise take one more line than the block has room for.
 *
 * Three rungs rather than two because the corpus and the plausible tail are
 * three different problems: an ordinary headline wants to be big, a long
 * subtitled one has to give type back, and a pathological one only has to stay
 * on the card. The whole corpus sits on the first rung today, which is the
 * intended resting state and not a sign the other two are dead: they are what
 * stops a future title from overflowing, and the test exercises them directly.
 *
 * @type {ReadonlyArray<{ maxChars: number, fontSize: number }>}
 */
export const TITLE_SIZES = [
  { maxChars: 72, fontSize: 72 },
  { maxChars: 110, fontSize: 54 },
  { maxChars: TITLE_MAX, fontSize: 42 },
];

/**
 * The description's cut, in characters: two lines of the muted type, with
 * headroom for the wrap.
 *
 * MEASURED 2026-08-30 the same way. Two lines is the design, and it is enforced
 * HERE rather than by a line clamp, because satori has no working line clamp:
 * `WebkitLineClamp` renders identically with and without it, measured on satori
 * 0.29.0 while the previous template was built, and a clamp that does nothing
 * is worse than no clamp because it reads like a guarantee.
 */
export const DESCRIPTION_MAX = 132;

/**
 * Trailing punctuation that must not be left dangling in front of the ellipsis,
 * so a cut never produces a comma followed by three dots.
 *
 * Built from a STRING with the two long dashes as `\u` escapes, rather than
 * written as a regex literal carrying them. This repo bans those characters in
 * its own bytes and a hook enforces it, so the escape is the only spelling that
 * can land here at all.
 */
const DANGLING_PUNCTUATION = new RegExp("[,;:.\\u2014\\u2013-]+$");

/**
 * Cuts text on a WORD boundary and marks the cut, or returns it untouched.
 *
 * Never mid-word: a card is read at a glance and a headline severed inside a
 * word reads as a rendering fault rather than as an abbreviation.
 *
 * A single word longer than the cap is the one case with no word boundary to
 * cut on; it is cut anyway, because running off the card is worse.
 *
 * @param {string | null | undefined} value
 * @param {number} max
 * @returns {string}
 */
export function clampWords(value, max) {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(DANGLING_PUNCTUATION, "")}…`;
}

/**
 * The title as the card draws it.
 *
 * @param {string | null | undefined} title
 * @returns {string}
 */
export function cardTitle(title) {
  return clampWords(title, TITLE_MAX);
}

/**
 * The description as the card draws it. An absent description draws nothing,
 * and the layout closes up around it rather than leaving a hole.
 *
 * @param {string | null | undefined} description
 * @returns {string}
 */
export function cardDescription(description) {
  return clampWords(description, DESCRIPTION_MAX);
}

/**
 * The title's font size in card pixels, fitted to its length.
 *
 * FAILS LOUD rather than substituting, per hard rule 13: the ladder's last rung
 * is bounded by `TITLE_MAX` and the caller is expected to have clamped, so a
 * string past the end of the ladder means the two constants have come apart
 * and every card would silently take a size nobody chose. There is no `??`
 * here and there must not be one.
 *
 * @param {string} title the title AS DRAWN, i.e. already through `cardTitle`
 * @returns {number}
 */
export function titleFontSize(title) {
  const length = (title ?? "").length;
  for (const rung of TITLE_SIZES) {
    if (length <= rung.maxChars) return rung.fontSize;
  }
  throw new Error(
    `og-card-text: a ${length}-character title is past the last rung of the ` +
      `ladder (${TITLE_MAX}). Titles must go through cardTitle() first.`,
  );
}
