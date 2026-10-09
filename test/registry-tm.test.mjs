import assert from "node:assert/strict";
import test from "node:test";

import { NEB_TM_CALCULATOR, TM_CONDITIONS, TM_MIN_LENGTH, annealingSentence, primerTm, primerTmRounded, tmStatement } from "../app/kb/registry/tm.mjs";

/* The reference is Biopython 1.88, Bio.SeqUtils.MeltingTemp.Tm_NN with nn_table=DNA_NN3 (SantaLucia 1998), Na=50 mM, no
 * K, Tris, Mg or dNTPs, dnac1=500 nM, dnac2=0 and saltcorr=5 (the 1998 entropy correction), run on 2026-10-04, with selfcomp=True for the two
 * self-complementary sequences (Biopython does not detect them). These
 * are its outputs for the lab's twelve primers and three edge cases: two self-complementary sequences (the symmetry
 * term) and a homopolymer. A change to a nearest-neighbour value, an end term or the salt
 * correction moves one of them. */
const REFERENCE = {
  CATACTGAGCCAATGGTT: 51.7294,
  AATGTTGTACCGAAGTACT: 50.7081,
  CAAATAATAGATTTTCTAGTAGATACGGGA: 54.8551,
  AGTGGACGGGTCTCAGGA: 59.0711,
  CGAGAAGTAGCTATACGTCCTTTG: 57.2145,
  ACATCGTGCCCGGAGC: 60.0396,
  ATGAGGACTTGTTAGATTGGTTAC: 54.82,
  TGATGGCGTCAGGGCTATTTG: 59.7917,
  GGTCAACAAATCATAAAGATATTGG: 53.0228,
  TAAACTTCAGGGTGACCAAAAAATCA: 57.607,
  GTGGTGCTAAGCGTGTTATCATC: 58.6161,
  GGCAGCACCTCTGCCATC: 60.7531,
  CGCGAATTCGCG: 48.3695,
  GAATTCGAATTC: 30.7108,
  AAAAAAAAAAAAAAAAAAAA: 40.8506,
};

test("the Tm agrees with Biopython's SantaLucia 1998 nearest-neighbour to a thousandth of a degree", () => {
  for (const [sequence, expected] of Object.entries(REFERENCE)) {
    const tm = primerTm(sequence);
    assert.notEqual(tm, null, sequence);
    assert.ok(Math.abs(/** @type {number} */ (tm) - expected) < 0.001, `${sequence}: ${tm} against Biopython's ${expected}`);
  }
});

test("a Tm is rounded to one decimal for display, and only for what has one", () => {
  assert.equal(primerTmRounded("CATACTGAGCCAATGGTT"), 51.7);
  assert.equal(primerTmRounded("GGCAGCACCTCTGCCATC"), 60.8);
});

test("a sequence with an ambiguity code, another base or too few bases has no Tm: null, never a guess", () => {
  for (const sequence of ["ACGTRYACGTAC", "ACGTNNACGTAC", "ACGUACGUACGU", "acgtacgtacgt", "", "ACGTACGT".slice(0, TM_MIN_LENGTH - 2)]) {
    assert.equal(primerTm(sequence), null, JSON.stringify(sequence));
    assert.equal(primerTmRounded(sequence), null);
  }
});

test("a longer, GC-richer primer melts hotter than a shorter, A-T-richer one, and the order of the bases matters", () => {
  assert.ok(/** @type {number} */ (primerTm("GGCAGCACCTCTGCCATC")) > /** @type {number} */ (primerTm("CATACTGAGCCAATGGTT")));
  assert.notEqual(primerTm("ACGTACGTAAGGCC"), primerTm("CCGGAATGCATGCA"));
});

test("the page's statement names the method, its citation, and the stored conditions, from the constants", () => {
  const text = tmStatement();
  assert.ok(text.includes(TM_CONDITIONS.method));
  assert.ok(text.includes(TM_CONDITIONS.citation));
  assert.ok(text.includes(`${TM_CONDITIONS.sodiumMM} mM`));
  assert.ok(text.includes(`${TM_CONDITIONS.primerNM / 1000} `));
  assert.match(text, /is an estimate for comparing primers/, "labelled an estimate, for comparing primers (protocols.md, 2026-10-04)");
  assert.ok(!/annealing/i.test(text), "the Tm statement never mentions an annealing temperature as the Tm");
  const wide = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
  assert.ok(!wide.test(text), "no wide dash");
});

test("no Tm is presented as an annealing temperature: the sentence that follows it says it is not, and names the NEB calculator", () => {
  const text = annealingSentence();
  assert.match(text, /The Tm estimate is not an annealing temperature./);
  assert.ok(text.includes(NEB_TM_CALCULATOR.url) && NEB_TM_CALCULATOR.url === "https://tmcalculator.neb.com/");
  assert.match(text, /annealing temperature of a particular polymerase/);
});
