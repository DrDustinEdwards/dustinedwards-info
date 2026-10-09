// The strain kind of the lab registry (docs/REGISTRY.md): the bacterial hosts the lab's phage work grows. A strain record
// states what the lab's own pages state about one host (its organism, the strain designation where it has one, the culture
// collection and the number the collection gives it, the SEA-PHAGES Guide's page for it) and the biosafety level, which is
// Dustin's to set and is MISSING until the biosafety officer check is done (core.md).
//
// The strain's id is the phages' host key (app/lib/phages/compile.mjs HOSTS), so a phage's host and a strain are one word,
// and what follows from it is COMPUTED: the phages isolated on the host are read from the phages table, the protocols that use
// the strain are read from the protocols (which name their host strains by id), and the strain's full name is its organism and
// designation, which the record's `name` must equal.

import { BIOSAFETY_LEVELS } from "../procedures/validate.mjs";
import { stated } from "./primer.mjs";

const LINE = /^[^\r\n]+$/;

/** @param {unknown} value @param {number} max */
const oneLine = (value, max) =>
  typeof value === "string" && LINE.test(value) && value === value.trim() && value.length <= max ? null : `is one line of at most ${max} characters`;

/** @type {import("./kinds.mjs").KindSpec} */
export const STRAIN = {
  singular: "strain",
  plural: "strains",
  fields: {
    organism: { required: true, check: (value) => oneLine(value, 120) },
    // The lab's designation within the species, where there is one apart from the collection's number (mc²155).
    strain: { check: (value) => oneLine(value, 60) },
    collection: { required: true, check: (value) => oneLine(value, 60) },
    collection_number: { required: true, check: (value) => oneLine(value, 40) },
    guide_url: { check: (value) => (typeof value === "string" && /^https:\/\/[^\s]+$/.test(value) ? null : "is an https address") },
    // Dustin's to set: a gap until the biosafety officer check is done.
    biosafety_level: {
      required: true,
      check: (value) => (BIOSAFETY_LEVELS.includes(/** @type {any} */ (value)) ? null : `is one of ${BIOSAFETY_LEVELS.join(", ")}, or "MISSING: <why>" until Dustin sets it`),
    },
  },
  /** The name is the organism and its designation, so it is stated once and cannot say a different strain than the fields do. */
  setErrors(items) {
    /** @type {string[]} */
    const errors = [];
    for (const { id, name, fields } of items) {
      const organism = stated(fields.organism);
      const designation = designationOf(fields);
      if (organism && designation && name !== `${organism} ${designation}`) {
        errors.push(`strain/${id} is named "${name}", but its organism and designation make "${organism} ${designation}"; the name is computed from them`);
      }
    }
    return errors;
  },
};

/**
 * How the strain is designated: the lab's own designation where there is one, otherwise the collection and its number.
 *
 * @param {Record<string, unknown>} fields
 */
export function designationOf(fields) {
  const strain = stated(fields.strain);
  if (strain) return strain;
  const collection = stated(fields.collection);
  const number = stated(fields.collection_number);
  return collection && number ? `${collection} ${number}` : null;
}

/**
 * A strain as a protocol carries it (`StoredStrain` in app/kb/procedures/render.mjs): the stated facts, none computed, so the
 * protocol's page, twin and frozen versions name one strain.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render.mjs").StoredStrain}
 */
export function storedStrain(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    organism: stated(f.organism),
    strain: stated(f.strain),
    collection: stated(f.collection),
    collectionNumber: stated(f.collection_number),
  };
}
