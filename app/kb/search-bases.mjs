// The knowledge base facet of the site's search (docs/KNOWLEDGE-BASE.md, step 8, finding A2): one search across every knowledge
// base, narrowed to one of them by its entries' address. Each base's entries live under its entry root (bases.mjs) and the lab
// registry's items under /research/lab, so a record's base is read from its address and never stored on the record. Each
// library keeps its own facets; this is the one the search adds.

import { BASES } from "./bases.mjs";
import { LAB_PATH } from "./registry/catalog.mjs";

/** The facet's values in the order the search lists them: each knowledge base, then the lab registry. */
export const SEARCH_BASES = Object.freeze([
  ...BASES.map((base) => ({ id: base.id, label: base.name, prefix: base.entryRoot })),
  { id: "lab", label: "Lab registry", prefix: `${LAB_PATH}/` },
]);

/** The base a search record belongs to, from its address, or null for a record in no base. @param {string} url */
export function baseOfUrl(url) {
  return SEARCH_BASES.find((base) => url.startsWith(base.prefix))?.id ?? null;
}

/** A base's words, for its facet chip; an id no base has is shown as typed. @param {string} id */
export function baseLabel(id) {
  return SEARCH_BASES.find((base) => base.id === id)?.label ?? id;
}

/** The address prefix of a base, or null for an id no base has. @param {string} id */
export function basePrefix(id) {
  return SEARCH_BASES.find((base) => base.id === id)?.prefix ?? null;
}
