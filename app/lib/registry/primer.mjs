// The primer kind of the lab registry (docs/REGISTRY.md). A primer record states what the lab's protocols state about
// one oligo and nothing else: its sequence as stored, its direction, the set it works in and what that set targets, the
// product size where a protocol states one, and where the sequence came from. Its Tm, its length and its reverse
// complement are COMPUTED from the sequence (tm.mjs, primers.mjs) and never stored, so they cannot drift from it, and
// the protocols that use it are found by the sequence, not listed here.

import { primerTmRounded } from "./tm.mjs";

/** An upper-case IUPAC nucleotide sequence, as the protocols write one. */
const SEQUENCE = /^[ACGTRYSWKMBDHVN]+$/;
export const PRIMER_MIN_LENGTH = 10;
export const PRIMER_MAX_LENGTH = 80;
export const DIRECTIONS = /** @type {const} */ (["forward", "reverse", "probe"]);
/** A product as a protocol states it: a size in base pairs, "about" when the source says so. */
const PRODUCT = /^(?:about )?[1-9][0-9]{1,4} bp$/;
const LINE = /^[^\r\n]+$/;

/** @param {unknown} value @param {number} max */
const oneLine = (value, max) =>
  typeof value === "string" && LINE.test(value) && value === value.trim() && value.length <= max ? null : `is one line of at most ${max} characters`;

/** @type {import("./kinds.mjs").KindSpec} */
export const PRIMER = {
  singular: "primer",
  plural: "primers",
  fields: {
    sequence: {
      required: true,
      check: (value) =>
        typeof value !== "string" || !SEQUENCE.test(value)
          ? "is an upper-case IUPAC nucleotide sequence, written 5' to 3' as stored"
          : value.length < PRIMER_MIN_LENGTH || value.length > PRIMER_MAX_LENGTH
            ? `is ${PRIMER_MIN_LENGTH} to ${PRIMER_MAX_LENGTH} bases`
            : null,
    },
    direction: {
      required: true,
      check: (value) => (DIRECTIONS.includes(/** @type {any} */ (value)) ? null : `is ${DIRECTIONS.join(", ")} or MISSING`),
    },
    target: { required: true, check: (value) => oneLine(value, 120) },
    set: { check: (value) => oneLine(value, 120) },
    product: {
      check: (value) => (typeof value === "string" && PRODUCT.test(value) ? null : 'is a size as the protocol states it, such as "281 bp" or "about 710 bp"'),
    },
    source: { check: (value) => oneLine(value, 200) },
    source_url: {
      check: (value) => (typeof value === "string" && /^https:\/\/[^\s]+$/.test(value) ? null : "is an https address"),
    },
    paper: {
      check: async (value, { host }) =>
        typeof value === "string" && (await host.paper(value)) ? null : "is the file key of a publication this site holds",
    },
  },
  /**
   * What only the whole set can say: a sequence is stored once (two records cannot hold it), a set holds at most one
   * forward and one reverse primer, and a product belongs to a pair, so it is stated on the forward primer alone.
   */
  setErrors(items) {
    /** @type {string[]} */
    const errors = [];
    /** @type {Map<string, string>} */
    const sequences = new Map();
    /** @type {Map<string, { forward: string[], reverse: string[] }>} */
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
        const entry = sets.get(set) ?? { forward: [], reverse: [] };
        if (fields.direction === "forward") entry.forward.push(id);
        if (fields.direction === "reverse") entry.reverse.push(id);
        sets.set(set, entry);
      }
      if (typeof fields.product === "string" && !fields.product.startsWith("MISSING") && fields.direction !== "forward") {
        errors.push(`primer/${id} states a product, but a product is a pair's and is stated on its forward primer`);
      }
    }
    for (const [set, { forward, reverse }] of sets) {
      if (forward.length > 1) errors.push(`the set "${set}" has ${forward.length} forward primers (${forward.join(", ")}); a set has one`);
      if (reverse.length > 1) errors.push(`the set "${set}" has ${reverse.length} reverse primers (${reverse.join(", ")}); a set has one`);
    }
    return errors;
  },
};

/**
 * What a primer's page and rows derive from its record: its length, GC content and Tm, all computed from the sequence,
 * and null where the sequence is not one the model applies to (a gap, or an ambiguity code).
 *
 * @param {string} sequence
 */
export function primerFacts(sequence) {
  if (!/^[ACGT]+$/.test(sequence)) return { length: /^[A-Z]+$/.test(sequence) ? sequence.length : null, gcPercent: null, tm: null };
  const gc = [...sequence].filter((base) => base === "G" || base === "C").length;
  return { length: sequence.length, gcPercent: Math.round((gc / sequence.length) * 1000) / 10, tm: primerTmRounded(sequence) };
}

/** A field as text: a recorded gap (MISSING: why) and an absent value are both nothing to show. @param {unknown} value */
function stated(value) {
  return typeof value === "string" && value !== "" && !value.startsWith("MISSING") ? value : null;
}

/**
 * A primer as a protocol carries it (`StoredPrimer` in app/lib/procedures/render.mjs): the registry's stated facts, none
 * computed. The protocol's record holds these so its page, sheet, twin and frozen versions print one sequence.
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
  };
}
