// Its own module because ogImageKey must hash the same clamped strings the card draws, and because a
// route names a page's card through it without importing the markdown renderer. Characters stand in
// for width, so every number here was measured off rendered cards.

import { CARD_DESCRIPTION_MAX, cardKey, clampTitle } from "@dustinedwards/site-runtime/share-card";
import { formatDate } from "capsomer/behavior/time";
import { ASSET_PREFIX } from "../media/classify.mjs";

/**
 * @param {string | null | undefined} title
 * @returns {string}
 */
export function cardTitle(title) {
  return clampTitle(title);
}

/**
 * @param {string | null | undefined} description
 * @returns {string}
 */
export function cardDescription(description) {
  return clampTitle(description, CARD_DESCRIPTION_MAX);
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
