/**
 * The one definition of "a paper" on the site: the types the index, its exports and the home page's count show.
 * Conference abstracts stay in the data file, which the CV also reads, and are not counted.
 */

/** @typedef {import("./types.ts").PublicationType} PublicationType */

/** @type {Set<PublicationType>} */
export const SHOWCASE_TYPES = new Set(["article", "review", "chapter", "teaching-resource"]);

/** @param {{ type: PublicationType }} p */
export function isShowcase(p) {
  return SHOWCASE_TYPES.has(p.type);
}
