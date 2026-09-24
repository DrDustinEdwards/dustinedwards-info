// Its own module because ogImageKey in pipeline.mjs must hash the same clamped strings the card
// draws. Characters stand in for width, so every number here was measured off rendered cards.

export const TITLE_MAX = 150;

/**
 * Measured off rendered 1200x630 cards against the layout in build-og.mjs.
 *
 * @type {ReadonlyArray<{ maxChars: number, fontSize: number }>}
 */
export const TITLE_SIZES = [
  { maxChars: 72, fontSize: 72 },
  { maxChars: 110, fontSize: 54 },
  { maxChars: TITLE_MAX, fontSize: 42 },
];

// Two lines of description, enforced here because satori's WebkitLineClamp does nothing.
export const DESCRIPTION_MAX = 132;

// Dashes as escapes in a string: a hook bans those characters from the repo's bytes.
const DANGLING_PUNCTUATION = new RegExp("[,;:.\\u2014\\u2013-]+$");

/**
 * A single word longer than max is still cut: running off the card is worse.
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
 * @param {string | null | undefined} title
 * @returns {string}
 */
export function cardTitle(title) {
  return clampWords(title, TITLE_MAX);
}

/**
 * @param {string | null | undefined} description
 * @returns {string}
 */
export function cardDescription(description) {
  return clampWords(description, DESCRIPTION_MAX);
}

/**
 * Throws, never falls back: a title past the last rung means TITLE_MAX and the ladder disagree.
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
