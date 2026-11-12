// Its own module because ogImageKey must hash the same clamped strings the card draws, and because a
// route names a page's card through it without importing the markdown renderer. Characters stand in
// for width, so every number here was measured off rendered cards.

import {
  CARD_DESCRIPTION_MAX,
  CARD_TITLE_MAX,
  CARD_TITLE_SIZES,
  cardKey,
  clampTitle,
} from "@dustinedwards/site-runtime/share-card";
import { formatDate } from "capsomer/behavior/time";
import { ASSET_PREFIX } from "../media/classify.mjs";

/** The network's card sizes (site-runtime ./share-card), measured off rendered 1200x630 cards. */
export const TITLE_MAX = CARD_TITLE_MAX;
export const TITLE_SIZES = CARD_TITLE_SIZES;
// Two lines of description, enforced here because satori's WebkitLineClamp does nothing.
export const DESCRIPTION_MAX = CARD_DESCRIPTION_MAX;

/** `value` cut at a word to at most `max` characters, ending in an ellipsis (site-runtime clampTitle). */
export const clampWords = clampTitle;

/**
 * @param {string | null | undefined} title
 * @returns {string}
 */
export function cardTitle(title) {
  return clampTitle(title, TITLE_MAX);
}

/**
 * @param {string | null | undefined} description
 * @returns {string}
 */
export function cardDescription(description) {
  return clampTitle(description, DESCRIPTION_MAX);
}

// Bump on any card template change: the key hashes only the card's inputs, and an immutable cache
// ignores a restyled PNG under an unchanged key forever.
const OG_TEMPLATE_VERSION = 7;

/**
 * Hashes exactly what the card draws, AS DRAWN (through cardTitle, cardDescription, formatDate), so
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
  return cardKey({
    slug: post.slug,
    parts: [cardTitle(post.title), cardDescription(post.description), formatDate(post.publishAt)],
    version: OG_TEMPLATE_VERSION,
    prefix: `og/${ASSET_PREFIX}`,
  });
}
