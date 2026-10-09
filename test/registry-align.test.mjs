import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { MAX_MISMATCHES, pairProducts, placePrimer, productsForRows } from "../app/kb/registry/align.mjs";
import { accessionPosition, parseReference } from "../app/kb/registry/reference.mjs";
import { REFERENCES } from "../app/kb/registry/references.generated.mjs";
import { readReferences, referenceFile, referencesModule } from "../scripts/lib/references.mjs";

/* Placing a primer on a reference and computing a pair's product (docs/REGISTRY.md). The cases are worked by hand on
 * references built here, so the arithmetic is held to numbers a reader can count, and then the real references are held to what
 * the repository's protocols and papers state. */

const F = "GGATCGATCGTTAGC"; // 15 nt, bases 6 to 20 of the reference below
const R = "TGCATGCATGCAT"; // 13 nt; its reverse complement is ATGCATGCATGCA
const RC_R = "ATGCATGCATGCA";
const fasta = (header, sequence) => `>${header}\n${sequence.match(/.{1,70}/g).join("\n")}\n`;
//                 1-5    6-20  21-30        31-43  44-48
const SEQUENCE = `CCCCC${F}AAAAAAAAAA${RC_R}CCCCC`;
const whole = parseReference(fasta("AB000001.1 A built-for-the-test record", SEQUENCE));
const region = parseReference(fasta("NC_000001.1:1000-1047 A slice of a chromosome", SEQUENCE));

test("a reference is NCBI's own FASTA, whole or a slice, and its header must say the length the sequence is", () => {
  assert.deepEqual([whole.id, whole.accession, whole.from, whole.to], ["AB000001.1", "AB000001.1", 1, 48]);
  assert.deepEqual([region.id, region.accession, region.from, region.to], ["NC_000001.1:1000-1047", "NC_000001.1", 1000, 1047]);
  assert.equal(whole.description, "A built-for-the-test record");
  assert.throws(() => parseReference(fasta("NC_000001.1:1000-1050 A slice", SEQUENCE)), /spans 1000-1050 \(51 bases\) but the sequence is 48/);
  assert.throws(() => parseReference(fasta("not a header", SEQUENCE)), /is not an NCBI FASTA header/);
  assert.throws(() => parseReference(fasta("AB000001.1 With an ambiguity", `${SEQUENCE.slice(0, 10)}N${SEQUENCE.slice(11)}`)), /other than A, C, G and T/);
});

test("a position is in the accession's own coordinates: a slice's offset is added back", () => {
  assert.equal(accessionPosition(whole, 6), 6);
  assert.equal(accessionPosition(region, 1), 1000);
  assert.equal(accessionPosition(region, 6), 1005);
});

test("a primer is placed with its strand, span and mismatches, exactly first", () => {
  const forward = placePrimer(F, whole.id, { [whole.id]: whole });
  assert.deepEqual(forward?.reference, { id: "AB000001.1", accession: "AB000001.1", description: "A built-for-the-test record" });
  assert.deepEqual(forward?.sites, [{ strand: "+", start: 6, end: 20, mismatches: 0, mismatchPositions: [] }]);
  const reverse = placePrimer(R, whole.id, { [whole.id]: whole });
  // R reads on the other strand: its 5' end is at the right-hand end of its site, base 43.
  assert.deepEqual(reverse?.sites, [{ strand: "-", start: 31, end: 43, mismatches: 0, mismatchPositions: [] }]);
  assert.equal(placePrimer(F, region.id, { [region.id]: region })?.sites[0]?.start, 1005, "a slice reports chromosome coordinates");
});

test("a primer that binds only with mismatches is placed at the fewest, and each is reported, never absorbed", () => {
  // The second base of F is changed (G to T) and the last is changed (C to A): two mismatches, at primer bases 2 and 15.
  const twisted = `${F.slice(0, 1)}T${F.slice(2, 14)}A`;
  const placed = placePrimer(twisted, whole.id, { [whole.id]: whole });
  assert.equal(placed?.mismatches, 2);
  assert.deepEqual(placed?.sites, [{ strand: "+", start: 6, end: 20, mismatches: 2, mismatchPositions: [2, 15] }]);
  // Past the limit it is not placed at all: a poor fit is no placement.
  const far = `${"A".repeat(MAX_MISMATCHES + 3)}${F.slice(MAX_MISMATCHES + 3)}`;
  assert.equal(placePrimer(far, whole.id, { [whole.id]: whole }), null);
  assert.equal(placePrimer("ACGTACGTACGTACGT", "NO-SUCH-REFERENCE.1", { [whole.id]: whole }), null, "an unknown reference places nothing");
  assert.equal(placePrimer("ACGRTACGTACG", whole.id, { [whole.id]: whole }), null, "an ambiguity code has no single placement");
});

test("a pair's product runs from the forward primer's 5' end to the reverse primer's 5' end, inclusive", () => {
  const pair = pairProducts(F, R, whole.id, { [whole.id]: whole });
  assert.deepEqual(pair?.products.map((p) => [p.length, p.start, p.end]), [[38, 6, 43]]);
  assert.deepEqual(pairProducts(F, R, region.id, { [region.id]: region })?.products.map((p) => [p.length, p.start, p.end]), [[38, 1005, 1042]]);
  assert.equal(pairProducts(F, "GGGGGGGGGGGGG", whole.id, { [whole.id]: whole }), null, "a primer that binds nowhere makes no product");
});

test("a pair that binds twice makes two products, as the two LTRs of a provirus do", () => {
  const twice = parseReference(fasta("AB000002.1 Two copies", `${SEQUENCE}GGGGG${SEQUENCE}`));
  const pair = pairProducts(F, R, twice.id, { [twice.id]: twice });
  // Both copies' own products, and the longer one between the first copy's forward and the second copy's reverse, which a PCR
  // makes too while it is under MAX_PRODUCT. (On the real REV genome the two LTRs are 7.7 kb apart, so only the two
  // 281 bp products remain.)
  assert.deepEqual(pair?.products.map((p) => [p.length, p.start, p.end]), [[38, 6, 43], [38, 59, 96], [91, 6, 96]]);
});

test("a protocol's primers give each set's product on both of its rows, and only where the set pairs on one reference", () => {
  const rows = [
    { id: "a-f", set: "S", direction: "forward", sequence: F, reference: whole.id },
    { id: "a-r", set: "S", direction: "reverse", sequence: R, reference: whole.id },
    { id: "b-f", set: "T", direction: "forward", sequence: F, reference: whole.id },
    { id: "c-f", set: "U", direction: "forward", sequence: F, reference: whole.id },
    { id: "c-r", set: "U", direction: "reverse", sequence: R, reference: "OTHER.1" },
    { id: "d-f", set: null, direction: "forward", sequence: F, reference: whole.id },
  ];
  // The real references are not the test's, so the map is read with the module's own: only sets on a known reference place.
  const real = productsForRows(rows);
  assert.equal(real.size, 0, "AB000001.1 is not in data/references, so nothing places");
  const known = REFERENCES["U09568.1"];
  assert.ok(known);
  const lpdv = productsForRows([
    { id: "f", set: "L", direction: "forward", sequence: "ATGAGGACTTGTTAGATTGGTTAC", reference: "U09568.1" },
    { id: "r", set: "L", direction: "reverse", sequence: "TGATGGCGTCAGGGCTATTTG", reference: "U09568.1" },
    { id: "x", set: "M", direction: "forward", sequence: "ATGAGGACTTGTTAGATTGGTTAC", reference: "U09568.1" },
  ]);
  assert.deepEqual([...lpdv.keys()].sort(), ["f", "r"]);
  assert.equal(lpdv.get("f")?.products[0]?.length, 458);
  assert.equal(lpdv.get("f"), lpdv.get("r"));
});

test("the real references are the records they name, kept as NCBI wrote them, and the generated module is built from them", () => {
  const read = readReferences();
  assert.deepEqual(Object.keys(read).sort(), ["DQ387450.1", "NC_052532.1:76902320-76906237", "NC_139404.1:75777043-75780966", "U09568.1", "X03240.1"]);
  assert.equal(read["DQ387450.1"].sequence.length, 8286, "the REV APC-566 genome is the 8,286 nt the protocol cites");
  assert.equal(read["NC_052532.1:76902320-76906237"].from, 76902320);
  assert.match(read["X03240.1"].description, /Drosophila yakuba/);
  for (const name of readdirSync(new URL("../data/references/", import.meta.url))) {
    const id = Object.keys(read).find((key) => referenceFile(key) === name);
    assert.ok(id, `${name} is a reference file`);
    assert.ok(readFileSync(new URL(`../data/references/${name}`, import.meta.url), "utf8").startsWith(">"), `${name} keeps NCBI's header`);
  }
  assert.equal(readFileSync(new URL("../app/kb/registry/references.generated.mjs", import.meta.url), "utf8"), referencesModule(read), "the module is what the files generate");
});
