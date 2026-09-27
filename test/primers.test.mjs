import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { amplicon, amplicons, findSites, normalize, parseFasta, reverseComplement } from "../app/lib/primers.mjs";

const reference = (/** @type {string} */ accession) =>
  parseFasta(readFileSync(new URL(`./fixtures/references/${accession}.fasta`, import.meta.url), "utf8")).sequence;

test("normalize upper-cases, maps U to T, drops whitespace, and refuses anything not a nucleotide code", () => {
  assert.equal(normalize(" acgu\n ACGT "), "ACGTACGT");
  assert.throws(() => normalize("ACG1T"));
});

test("reverseComplement, by hand, including the IUPAC ambiguity codes", () => {
  assert.equal(reverseComplement("AACG"), "CGTT");
  assert.equal(reverseComplement("ATGC"), "GCAT");
  // R<->Y, K<->M, B<->V, D<->H; S, W and N map to themselves.
  assert.equal(reverseComplement("RYKMBVDHSWN"), "NWSDHBVKMRY");
  assert.equal(reverseComplement(reverseComplement("CATACTGGAGCCAATGGTT")), "CATACTGGAGCCAATGGTT");
});

test("parseFasta reads the header and joins the sequence lines", () => {
  const { header, sequence } = parseFasta(">X1 test\nACGT\nacgt\n");
  assert.equal(header, "X1 test");
  assert.equal(sequence, "ACGTACGT");
});

/*
 * A synthetic template: 4 bases, the forward primer (10), a 10-base spacer, the reverse complement of the
 * reverse primer (10), 4 bases. By hand: the product runs from base 5 to base 34, 30 bases long.
 */
const F = "ACGTACGTAC";
const R = "GGATCCTTAG";
const TEMPLATE = `AAAA${F}CCCCCCCCCC${reverseComplement(R)}TTTT`;

test("findSites finds a primer on each strand, 1-based and inclusive", () => {
  assert.deepEqual(
    findSites(TEMPLATE, F).map((s) => [s.strand, s.start, s.end, s.mismatches]),
    [["+", 5, 14, 0]],
  );
  assert.deepEqual(
    findSites(TEMPLATE, R).map((s) => [s.strand, s.start, s.end, s.mismatches]),
    [["-", 25, 34, 0]],
  );
});

test("the synthetic product is 30 bases, 5 to 34, with no edits", () => {
  const product = amplicon(TEMPLATE, F, R);
  assert.deepEqual(
    [product.start, product.end, product.length, product.templateLength, product.forwardMismatches, product.reverseMismatches],
    [5, 34, 30, 30, 0, 0],
  );
});

test("a mismatch is counted at its primer position, and refused past the allowance", () => {
  const mutated = `AAAA${F.slice(0, 3)}A${F.slice(4)}CCCCCCCCCC${reverseComplement(R)}TTTT`; // F's 4th base T -> A
  assert.throws(() => amplicon(mutated, F, R));
  const product = amplicon(mutated, F, R, { maxMismatches: 1 });
  assert.equal(product.forwardMismatches, 1);
  assert.deepEqual(product.forward.mismatchPositions, [4]);
  assert.equal(product.length, 30);
});

test("a primer with a base the template lacks is reported, and adds that base to the product", () => {
  const shorter = `AAAA${F.slice(0, 5)}${F.slice(6)}CCCCCCCCCC${reverseComplement(R)}TTTT`; // drop F's 6th base
  assert.throws(() => amplicon(shorter, F, R, { maxMismatches: 1 }));
  const product = amplicon(shorter, F, R, { maxIndels: 1 });
  assert.equal(product.forward.indel?.type, "extra-primer-base");
  assert.equal(product.templateLength, 29);
  assert.equal(product.length, 30);
});

test("a reference filed in the other orientation gives the same product", () => {
  assert.equal(amplicon(reverseComplement(TEMPLATE), F, R).length, 30);
});

/*
 * The real sets, on GenBank DQ387450 (REV strain APC-566, 8,286 nt), the reference Stewart et al. 2019
 * cite ("published REV proviral sequences from APC (GenBank DQ387450)"). Primers as the page gives them,
 * which match the Stewart and Cox supplements character for character.
 */
const REV = reference("DQ387450");

test("the fixture is the whole DQ387450 genome", () => {
  assert.equal(REV.length, 8286);
});

test("REV 3' LTR: 282 bp, in both LTRs, the forward primer one base longer than the reference and the reverse one mismatch", () => {
  const all = amplicons(REV, "CATACTGGAGCCAATGGTT", "AATGTTGTACCGAAGTACT", { maxMismatches: 1, maxIndels: 1, maxLength: 1000 });
  assert.deepEqual(
    all.map((p) => [p.start, p.end, p.length]),
    [
      [258, 538, 282],
      [8000, 8280, 282],
    ],
  );
  const [product] = all;
  assert.equal(product?.forward.indel?.type, "extra-primer-base");
  assert.equal(product?.forwardMismatches, 0);
  assert.equal(product?.reverseMismatches, 1);
});

test("REV pol 2500-3075: 574 bp at 2492-3065, both primers exact", () => {
  const product = amplicon(REV, "CAAATAATAGATTTTCTAGTAGATACGGGA", "AGTGGACGGGTCTCAGGA");
  assert.deepEqual([product.start, product.end, product.length], [2492, 3065, 574]);
});

test("REV pol 4777-5575: 801 bp at 4766-5566, one reverse-primer mismatch", () => {
  const product = amplicon(REV, "CGAGAAGTAGCTATACGTCCTTTG", "ACATCGTGCCCGGAGC", { maxMismatches: 1 });
  assert.deepEqual([product.start, product.end, product.length, product.reverseMismatches], [4766, 5566, 801, 1]);
});

/*
 * LPDV on GenBank U09568 (the Israeli prototype strain, 7,143 nt), the sequence Allison et al. 2014
 * (Virology 450-451:2-12) designed their primers on. The 413 nt between the primers is the partial p31/partial
 * CA fragment they analyzed.
 */
const LPDV = reference("U09568");
const LPDV_FORWARD = "ATGAGGACTTGTTAGATTGGTTAC";

test("the U09568 fixture is the whole 7,143 nt sequence", () => {
  assert.equal(LPDV.length, 7143);
});

test("LPDV, published pair: 458 bp at 1041-1498 with both primers exact, 413 bp between them", () => {
  const product = amplicon(LPDV, LPDV_FORWARD, "TGATGGCGTCAGGGCTATTTG");
  assert.deepEqual([product.start, product.end, product.length, product.forwardMismatches, product.reverseMismatches], [1041, 1498, 458, 0, 0]);
  assert.equal(product.length - LPDV_FORWARD.length - "TGATGGCGTCAGGGCTATTTG".length, 413);
});

