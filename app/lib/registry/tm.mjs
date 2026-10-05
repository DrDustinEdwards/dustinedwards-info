// A primer's melting temperature, computed from its sequence and never typed (a computable value is computed). The
// method and the conditions are stated on every page that shows a Tm, from the constants below, so a reader knows what
// the number means and a change of condition changes every page at once.
//
// METHOD. The unified nearest-neighbour model of SantaLucia (1998), Proc. Natl. Acad. Sci. USA 95:1460-1465, doi
// 10.1073/pnas.95.4.1460: the duplex's enthalpy and entropy are the sums of its dinucleotide steps plus an initiation
// term for each end, the entropy is corrected for the monovalent salt, and
//
//   Tm = 1000 x dH / (dS + R x ln(C)) - 273.15
//
// with dH in kcal/mol, dS in cal/(K x mol), R = 1.987 cal/(K x mol) and C the primer concentration. C is the primer
// concentration itself, not the total strand concentration over four, because in a PCR the primer is in large excess
// over the template (for strands at unequal concentration the term is C(excess) minus half of C(limiting), which is C when
// the template is far below the primer). A self-complementary primer also takes the symmetry term.
//
// CONDITIONS. 50 mM monovalent cation and 0.5 uM primer, with the template taken as far below the primer. They are the
// usual reporting defaults, not the conditions of any one reaction buffer (a master mix's own salt and Mg2+ shift the
// working Tm), so the figure is for comparing primers with each other. The page says so.
//
// A sequence with an ambiguity code or any base but A, C, G and T has no single Tm, so it has none here: null, never a
// guess. test/registry-tm.test.mjs holds this to Biopython's Bio.SeqUtils.MeltingTemp.Tm_NN (DNA_NN3, which carries the
// SantaLucia 1998 table, saltcorr 5, the template taken as zero).

/** The conditions every Tm on the site is computed under, stored once. */
export const TM_CONDITIONS = Object.freeze({
  /** Monovalent cation, mM. */
  sodiumMM: 50,
  /** Primer, nM. */
  primerNM: 500,
  method: "SantaLucia (1998) unified nearest-neighbour model",
  citation: "SantaLucia J Jr (1998), Proc Natl Acad Sci USA 95:1460-1465",
  doi: "10.1073/pnas.95.4.1460",
});

/** The shortest oligo the model is applied to; a Tm for fewer bases is not meaningful as a primer's. */
export const TM_MIN_LENGTH = 10;

const R = 1.987;

/** dH (kcal/mol) and dS (cal/(K x mol)) of each dinucleotide step, 5' to 3', SantaLucia 1998 Table 1. */
const STEP = /** @type {Record<string, [number, number]>} */ ({
  AA: [-7.9, -22.2],
  TT: [-7.9, -22.2],
  AT: [-7.2, -20.4],
  TA: [-7.2, -21.3],
  CA: [-8.5, -22.7],
  TG: [-8.5, -22.7],
  GT: [-8.4, -22.4],
  AC: [-8.4, -22.4],
  CT: [-7.8, -21.0],
  AG: [-7.8, -21.0],
  GA: [-8.2, -22.2],
  TC: [-8.2, -22.2],
  CG: [-10.6, -27.2],
  GC: [-9.8, -24.4],
  GG: [-8.0, -19.9],
  CC: [-8.0, -19.9],
});
/** Initiation at a terminal G-C pair and at a terminal A-T pair, added once per end. */
const INIT_GC = /** @type {[number, number]} */ ([0.1, -2.8]);
const INIT_AT = /** @type {[number, number]} */ ([2.3, 4.1]);
/** The symmetry correction for a self-complementary sequence (entropy only). */
const SYMMETRY_DS = -1.4;

const COMPLEMENT = /** @type {Record<string, string>} */ ({ A: "T", C: "G", G: "C", T: "A" });

/** @param {string} sequence */
function reverseComplement(sequence) {
  return [...sequence].reverse().map((base) => COMPLEMENT[base]).join("");
}

/**
 * The Tm in degrees Celsius, unrounded, or null when the sequence is not an unambiguous DNA oligo of at least
 * TM_MIN_LENGTH bases.
 *
 * @param {string} sequence 5' to 3', upper case
 * @returns {number | null}
 */
export function primerTm(sequence) {
  if (!/^[ACGT]+$/.test(sequence) || sequence.length < TM_MIN_LENGTH) return null;
  let dH = 0;
  let dS = 0;
  for (let i = 0; i < sequence.length - 1; i += 1) {
    const [h, s] = /** @type {[number, number]} */ (STEP[sequence.slice(i, i + 2)]);
    dH += h;
    dS += s;
  }
  for (const end of [sequence[0], sequence[sequence.length - 1]]) {
    const [h, s] = end === "G" || end === "C" ? INIT_GC : INIT_AT;
    dH += h;
    dS += s;
  }
  const selfComplementary = sequence === reverseComplement(sequence);
  if (selfComplementary) dS += SYMMETRY_DS;
  // The salt correction of SantaLucia (1998) eq. 8, applied to the entropy: 0.368 per phosphate (N - 1) x ln [Na+].
  dS += 0.368 * (sequence.length - 1) * Math.log(TM_CONDITIONS.sodiumMM / 1000);
  const concentration = TM_CONDITIONS.primerNM * 1e-9;
  return (1000 * dH) / (dS + R * Math.log(concentration)) - 273.15;
}

/** The Tm to one decimal, or null where there is none. @param {string} sequence */
export function primerTmRounded(sequence) {
  const tm = primerTm(sequence);
  return tm === null ? null : Math.round(tm * 10) / 10;
}

/**
 * The sentence every page that shows a Tm carries: what was computed and under what conditions, from the one set of
 * constants, so no page restates a number it could be wrong about.
 */
export function tmStatement() {
  const { sodiumMM, primerNM, method, citation } = TM_CONDITIONS;
  return (
    `Melting temperature (Tm) is computed from the sequence with the ${method} (${citation}), ` +
    `at ${sodiumMM} mM monovalent cation and ${primerNM / 1000} µM primer. These are standard reporting ` +
    `conditions, not those of any one reaction buffer, so the working annealing temperature of a master mix differs; ` +
    `use the figure to compare primers with each other. A sequence with an ambiguity code has no single Tm and shows none.`
  );
}
