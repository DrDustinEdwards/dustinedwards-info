// The reagent kind of the lab registry (docs/REGISTRY.md): the substances the lab's protocols use up, as distinct from the
// samples they work on (a lysate, soil, an eluate), the primers (their own kind) and the cultures (strains). A reagent record
// states what the lab's own pages state about one substance: its name, an abbreviation or what it is made of where a protocol
// says so, and, where a protocol links the product, who makes it, its catalog number and the product page.
//
// What the protocols use of it is COMPUTED, never stored: a protocol names a reagent on one of its materials by id
// (`reagent: <id>`), keeps the amounts, stocks and finals that are the protocol's own, and the reagent's page reads them back
// from the protocols that name it. A supplier or catalog number that no record in the repository states is `MISSING: <why>`,
// never filled from memory, and is listed for Dustin.

const LINE = /^[^\r\n]+$/;

/** @param {unknown} value @param {number} max */
const oneLine = (value, max) =>
  typeof value === "string" && LINE.test(value) && value === value.trim() && value.length <= max ? null : `is one line of at most ${max} characters`;

/** @type {import("./kinds.mjs").KindSpec} */
export const REAGENT = {
  singular: "reagent",
  plural: "reagents",
  fields: {
    // What a protocol calls it in one phrase, as the protocols' own words give it: ZnCl2 for zinc chloride.
    abbreviation: { check: (value) => oneLine(value, 40) },
    // What it is made of, where a protocol says: DNase I plus RNase A.
    contents: { check: (value) => oneLine(value, 120) },
    supplier: { required: true, check: (value) => oneLine(value, 80) },
    catalog_number: { required: true, check: (value) => oneLine(value, 40) },
    product_url: { check: (value) => (typeof value === "string" && /^https:\/\/[^\s]+$/.test(value) ? null : "is an https address") },
  },
};

/** A field as text: a recorded gap and an absent value are both nothing to show. @param {unknown} value */
export { stated, missingReason } from "./primer.mjs";

/**
 * A reagent as a protocol carries it (`StoredReagent` in app/lib/procedures/render.mjs): the stated facts, none computed, so the
 * protocol's page, twin and frozen versions name one reagent.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render.mjs").StoredReagent}
 */
export function storedReagent(item) {
  return { id: item.id, name: item.name, status: item.status };
}
