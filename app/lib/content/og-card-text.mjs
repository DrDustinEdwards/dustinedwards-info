// Its own module because ogImageKey must hash the same clamped strings the card draws, and because a
// route names a page's card through it without importing the markdown renderer. Characters stand in
// for width, so every number here was measured off rendered cards.

import { fnv1a32 } from "../bytes.mjs";
import { longDateUTC } from "../long-date.mjs";
import { ASSET_PREFIX } from "../media/classify.mjs";

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

// Bump on any card template change: the key hashes only the card's inputs, and an immutable cache
// ignores a restyled PNG under an unchanged key forever.
const OG_TEMPLATE_VERSION = 5;

/**
 * Hashes exactly what the card draws, AS DRAWN (through cardTitle, cardDescription, longDateUTC), so
 * the key changes when the picture would and never otherwise. FNV-1a: identical in Node and a Worker,
 * and this is a cache-busting key, not a security boundary.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */
export function ogImageKey(post) {
  const drawnDate = longDateUTC(post.publishAt);
  const input =
    `${OG_TEMPLATE_VERSION}\n${post.slug}\n${cardTitle(post.title)}\n` +
    `${cardDescription(post.description)}\n${drawnDate === null ? "" : drawnDate}`;
  return `og/${ASSET_PREFIX}${post.slug}-${fnv1a32(input)}.png`;
}
