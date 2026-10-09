// Placing a primer on a reference, and the product a pair makes there (docs/REGISTRY.md): COMPUTED by the primer code in
// app/lib/primers.mjs (findSites, amplicons), whose tests hold it to hand-worked cases, and never copied from a paper or a
// database. A primer is looked for exactly first, then with one mismatch more at a time up to MAX_MISMATCHES, and the first
// level that finds it is the answer, with its mismatches reported. A primer that binds only with a mismatch is therefore
// shown with the mismatch, never silently absorbed, and a primer that binds nowhere within the limit has no placement.
//
// Coordinates are the accession's own: a slice of a chromosome (`NC_052532.1:76902320-76906237`) is reported on the
// chromosome, so a reader can check a position against the record at NCBI.

import { amplicons, findSites } from "../../lib/primers.mjs";
import { accessionPosition, parseReference } from "./reference.mjs";
import { REFERENCES } from "./references.generated.mjs";

/** The most mismatches a primer may have against a reference and still be placed. A primer is 16 to 30 bases. */
export const MAX_MISMATCHES = 4;
/** A product longer than this is not a PCR product here; the registry's references are short or the primers sit close. */
export const MAX_PRODUCT = 5000;

/**
 * @typedef {import("./reference.mjs").Reference} Reference
 * @typedef {{
 *   strand: "+" | "-",
 *   start: number,
 *   end: number,
 *   mismatches: number,
 *   mismatchPositions: number[],
 * }} Placed
 * A site in the accession's own coordinates; `mismatchPositions` are 1-based from the primer's 5' end.
 *
 * @typedef {{ reference: { id: string, accession: string, description: string }, sites: Placed[], mismatches: number }} Placement
 * @typedef {{
 *   length: number,
 *   start: number,
 *   end: number,
 *   forward: Placed,
 *   reverse: Placed,
 * }} Product
 */

/** The reference an id names, or null. @param {string} id @param {Record<string, Reference>} [references] */
export function referenceFor(id, references = /** @type {any} */ (REFERENCES)) {
  const found = references[id];
  return found ? parseReferenceShape(found) : null;
}

/** The generated module's entries are already parsed; this keeps the type and refuses a malformed one. @param {any} entry @returns {Reference} */
function parseReferenceShape(entry) {
  if (typeof entry?.sequence !== "string" || typeof entry?.id !== "string") throw new Error("a reference in references.generated.mjs is malformed");
  return entry;
}

/** @param {Reference} reference @param {import("../../lib/primers.mjs").Site} site @returns {Placed} */
function placed(reference, site) {
  return {
    strand: site.strand,
    start: accessionPosition(reference, site.start),
    end: accessionPosition(reference, site.end),
    mismatches: site.mismatches,
    mismatchPositions: site.mismatchPositions,
  };
}

/**
 * Where a primer binds a reference: every site at the fewest mismatches that finds one.
 *
 * @param {string} sequence the primer, 5' to 3', A, C, G and T only
 * @param {string} referenceId
 * @param {Record<string, Reference>} [references]
 * @returns {Placement | null} null when the reference is unknown or the primer binds nowhere within MAX_MISMATCHES
 */
export function placePrimer(sequence, referenceId, references = /** @type {any} */ (REFERENCES)) {
  const reference = referenceFor(referenceId, references);
  if (!reference || !/^[ACGT]+$/.test(sequence)) return null;
  for (let mismatches = 0; mismatches <= MAX_MISMATCHES; mismatches += 1) {
    const sites = findSites(reference.sequence, sequence, { maxMismatches: mismatches }).filter((s) => s.mismatches === mismatches);
    if (sites.length > 0) {
      return {
        reference: { id: reference.id, accession: reference.accession, description: reference.description },
        sites: sites.map((site) => placed(reference, site)),
        mismatches,
      };
    }
  }
  return null;
}

/**
 * The products a forward and a reverse primer make on a reference, each at the fewest mismatches either needs, shortest
 * first. A pair that makes none, or whose primers do not both place, has no product.
 *
 * @param {string} forward
 * @param {string} reverse
 * @param {string} referenceId
 * @param {Record<string, Reference>} [references]
 * @returns {{ reference: Placement["reference"], products: Product[] } | null}
 */
export function pairProducts(forward, reverse, referenceId, references = /** @type {any} */ (REFERENCES)) {
  const reference = referenceFor(referenceId, references);
  const f = placePrimer(forward, referenceId, references);
  const r = placePrimer(reverse, referenceId, references);
  if (!reference || !f || !r) return null;
  const level = Math.max(f.mismatches, r.mismatches);
  const found = amplicons(reference.sequence, forward, reverse, { maxMismatches: level, maxLength: MAX_PRODUCT })
    // Only the sites each primer was placed at: a product that used a worse site than the best is not the pair's.
    .filter((p) => p.forward.mismatches === f.mismatches && p.reverse.mismatches === r.mismatches)
    .map((p) => ({
      length: p.length,
      start: accessionPosition(reference, p.start),
      end: accessionPosition(reference, p.end),
      forward: placed(reference, p.forward),
      reverse: placed(reference, p.reverse),
    }))
    .sort((a, b) => a.length - b.length || a.start - b.start);
  return found.length === 0 ? null : { reference: f.reference, products: found };
}

export { parseReference };

/**
 * The products a protocol's primers make, computed, for the primer table of a page, sheet or twin: each set that holds one
 * forward and one reverse primer on one reference gives its pair's products, keyed by the id of both primers. A row with no
 * mate, no reference or no placement has no entry.
 *
 * @param {Array<{ id: string, set: string | null, direction: string | null, sequence: string | null, reference: string | null }>} rows
 * @returns {Map<string, { reference: Placement["reference"], products: Product[] }>}
 */
export function productsForRows(rows) {
  /** @type {Map<string, { reference: Placement["reference"], products: Product[] }>} */
  const out = new Map();
  const sets = new Set(rows.flatMap((row) => (row.set ? [row.set] : [])));
  for (const set of sets) {
    const inSet = rows.filter((row) => row.set === set);
    const forward = inSet.find((row) => row.direction === "forward");
    const reverse = inSet.find((row) => row.direction === "reverse");
    if (!forward?.sequence || !reverse?.sequence || !forward.reference || forward.reference !== reverse.reference) continue;
    const pair = pairProducts(forward.sequence, reverse.sequence, forward.reference);
    if (pair) {
      out.set(forward.id, pair);
      out.set(reverse.id, pair);
    }
  }
  return out;
}
