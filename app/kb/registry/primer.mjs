// The primer kind of the lab registry (docs/REGISTRY.md). A primer record states what the lab's protocols state about one
// oligo (its sequence as stored, its direction, the set it works in and what that set targets) and what the literature says
// about it, as read: the paper that prints it, that paper's own name for it, the sequence the paper prints, the product size
// the paper states, and the reference sequence the primer is placed on.
//
// Anything not stored is COMPUTED and so cannot drift: its length, GC content, Tm and reverse complement come from the
// sequence (tm.mjs, primers.mjs); its position, strand and mismatches on the reference, and a pair's product, come from the
// reference by tested code (align.mjs); whether the stored sequence matches the printed one is a comparison, not a field; and
// the protocols that use it are found from the protocols, which name their primers by id.
//
// A fact nobody could read is written "MISSING: <why>" with the reason (paywalled, not stated), never filled from memory or
// inferred. A sequence that DIFFERS from the one a paper prints is shown as differing on its page and listed by
// check:content; it is never corrected silently, and the decision to change it is the seat's.

import { REFERENCES } from "./references.generated.mjs";
import { primerTmRounded } from "./tm.mjs";

/** An upper-case IUPAC nucleotide sequence, as the protocols write one. */
const SEQUENCE = /^[ACGTRYSWKMBDHVN]+$/;
export const PRIMER_MIN_LENGTH = 10;
export const PRIMER_MAX_LENGTH = 80;
export const DIRECTIONS = /** @type {const} */ (["forward", "reverse", "probe"]);
/** A product as a paper states it: a size in base pairs, "about" when the paper says so. */
const PRODUCT = /^(?:about )?[1-9][0-9]{1,4} bp$/;
const DOI = /^10\.[0-9]{4,9}\/[^\s]+$/;
const LINE = /^[^\r\n]+$/;

/** @param {unknown} value @param {number} max */
const oneLine = (value, max) =>
  typeof value === "string" && LINE.test(value) && value === value.trim() && value.length <= max ? null : `is one line of at most ${max} characters`;

/** @param {unknown} value */
const sequenceCheck = (value) =>
  typeof value !== "string" || !SEQUENCE.test(value)
    ? "is an upper-case IUPAC nucleotide sequence, written 5' to 3'"
    : value.length < PRIMER_MIN_LENGTH || value.length > PRIMER_MAX_LENGTH
      ? `is ${PRIMER_MIN_LENGTH} to ${PRIMER_MAX_LENGTH} bases`
      : null;

/** @type {import("./kinds.mjs").KindSpec} */
export const PRIMER = {
  singular: "primer",
  plural: "primers",
  fields: {
    sequence: { required: true, check: sequenceCheck },
    direction: {
      required: true,
      check: (value) => (DIRECTIONS.includes(/** @type {any} */ (value)) ? null : `is ${DIRECTIONS.join(", ")} or MISSING`),
    },
    target: { required: true, check: (value) => oneLine(value, 120) },
    set: { check: (value) => oneLine(value, 120) },
    // The reference the primer is placed on: a file in data/references (docs/REGISTRY.md), named by its GenBank id.
    reference: {
      check: (value) =>
        typeof value === "string" && Object.hasOwn(REFERENCES, value)
          ? null
          : `is the id of a reference in data/references: ${Object.keys(REFERENCES).join(", ")}`,
    },
    // The literature, as read. Each is the paper's own words or MISSING with the reason it could not be read.
    published_in: { required: true, check: (value) => oneLine(value, 200) },
    published_doi: { check: (value) => (typeof value === "string" && DOI.test(value) ? null : "is a DOI, such as 10.1371/journal.pone.0099678") },
    published_url: { check: (value) => (typeof value === "string" && /^https:\/\/[^\s]+$/.test(value) ? null : "is an https address") },
    published_name: { required: true, check: (value) => oneLine(value, 120) },
    published_sequence: { required: true, check: sequenceCheck },
    // The product size the paper states for the pair, on the forward primer only: a size is a pair's, and it is shown beside the
    // computed one, never in its place.
    published_product: {
      check: (value) => (typeof value === "string" && PRODUCT.test(value) ? null : 'is a size as the paper states it, such as "710 bp" or "about 710 bp"'),
    },
  },
  /**
   * What only the whole set can say: a sequence is stored once (two records cannot hold it), a set holds at most one forward and
   * one reverse primer, a published product is stated on the forward primer alone, and a pair shares one reference, because a
   * pair's product is computed on one sequence.
   */
  setErrors(items) {
    /** @type {string[]} */
    const errors = [];
    /** @type {Map<string, string>} */
    const sequences = new Map();
    /** @type {Map<string, { forward: string[], reverse: string[], references: Set<string> }>} */
    const sets = new Map();
    for (const { id, fields } of items) {
      const sequence = String(fields.sequence);
      const other = sequences.get(sequence);
      if (!sequence.startsWith("MISSING")) {
        if (other !== undefined) errors.push(`primer/${id} and primer/${other} hold the same sequence; a sequence is stored once`);
        else sequences.set(sequence, id);
      }
      const set = typeof fields.set === "string" ? fields.set : null;
      if (set !== null) {
        const entry = sets.get(set) ?? { forward: [], reverse: [], references: new Set() };
        if (fields.direction === "forward") entry.forward.push(id);
        if (fields.direction === "reverse") entry.reverse.push(id);
        if (typeof fields.reference === "string" && !fields.reference.startsWith("MISSING")) entry.references.add(fields.reference);
        sets.set(set, entry);
      }
      const product = fields.published_product;
      if (typeof product === "string" && !product.startsWith("MISSING") && fields.direction !== "forward") {
        errors.push(`primer/${id} states a published product, but a product is a pair's and is stated on its forward primer`);
      }
    }
    for (const [set, { forward, reverse, references }] of sets) {
      if (forward.length > 1) errors.push(`the set "${set}" has ${forward.length} forward primers (${forward.join(", ")}); a set has one`);
      if (reverse.length > 1) errors.push(`the set "${set}" has ${reverse.length} reverse primers (${reverse.join(", ")}); a set has one`);
      if (references.size > 1) errors.push(`the set "${set}" names ${references.size} references (${[...references].join(", ")}); a pair is placed on one`);
    }
    return errors;
  },
};

/**
 * What a primer's page and rows derive from its sequence alone: its length, GC content and Tm, and null where the sequence is
 * not one the model applies to (a gap, or an ambiguity code).
 *
 * @param {string} sequence
 */
export function primerFacts(sequence) {
  if (!/^[ACGT]+$/.test(sequence)) return { length: /^[A-Z]+$/.test(sequence) ? sequence.length : null, gcPercent: null, tm: null };
  const gc = [...sequence].filter((base) => base === "G" || base === "C").length;
  return { length: sequence.length, gcPercent: Math.round((gc / sequence.length) * 1000) / 10, tm: primerTmRounded(sequence) };
}

/** A field as text: a recorded gap (MISSING: why) and an absent value are both nothing to show. @param {unknown} value */
export function stated(value) {
  return typeof value === "string" && value !== "" && !value.startsWith("MISSING") ? value : null;
}

/** The reason a field is missing, or null when it is stated or absent. @param {unknown} value */
export function missingReason(value) {
  return typeof value === "string" && value.startsWith("MISSING:") ? value.replace(/^MISSING:\s*/, "") : null;
}

/**
 * A primer as a protocol carries it (`StoredPrimer` in app/kb/procedures/render.mjs): the registry's stated facts, none
 * computed. The protocol's record holds these so its page, sheet, twin and frozen versions print one sequence, and a pair's
 * product is computed from them where it is shown.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render.mjs").StoredPrimer}
 */
export function storedPrimer(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    set: stated(f.set),
    direction: stated(f.direction),
    sequence: stated(f.sequence),
    reference: stated(f.reference),
    // The paper that prints it, for a protocol's Key Resources Table; null where the registry records a gap.
    publishedIn: stated(f.published_in),
  };
}
