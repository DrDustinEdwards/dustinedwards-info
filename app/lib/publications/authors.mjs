// The alias table is explicit: a surname-plus-initial rule would fold Julie Edwards, a different
// person in the data, into the owner. Its own module so `seo.ts` can reach it without the exports'
// organism table. Must stay loadable by node:test.

import { decodeEntities } from "./entities.mjs";

// Exact spellings seen in the corpus, never patterns.
const AUTHOR_ALIASES = new Map([
  ["Dustin C. Edwards", "Dustin Edwards"],
  ["Dustin Cole Edwards", "Dustin Edwards"],
]);

/** @param {string} name */
export function canonicalAuthor(name) {
  const clean = decodeEntities(name).replace(/\s+/g, " ").trim();
  return AUTHOR_ALIASES.get(clean) ?? clean;
}
