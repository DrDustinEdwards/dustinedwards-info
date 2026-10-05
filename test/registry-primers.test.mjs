import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import matter from "gray-matter";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { libraryTabs } from "../app/lib/procedures/library.mjs";
import {
  INVENTORY,
  PRIMERS,
  inventoryRows,
  itemPath,
  kindFromSegment,
  kindPath,
  mateOf,
  pairProduct,
  primerRow,
  primerRows,
  protocolsUsing,
  registryTabs,
} from "../app/lib/registry/catalog.mjs";
import { compileRegistryItem, registrySetErrors } from "../app/lib/registry/compile.mjs";
import { KINDS } from "../app/lib/registry/kinds.mjs";
import { PRIMER, primerFacts } from "../app/lib/registry/primer.mjs";
import { primerTm } from "../app/lib/registry/tm.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The primer kind (docs/REGISTRY.md): the twelve records the lab's protocols state, what is computed from them, and the
 * guard that holds a protocol's own primer list equal to the registry's until the protocols read their tables from it. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const primers = built.items.filter((item) => item.kind === "primer");
const rows = primers.map(primerRow);
const byId = new Map(rows.map((row) => [row.id, row]));

/** Every procedure file, parsed: its front matter and its whole text. */
async function procedures() {
  const names = (await readdir(new URL("content/procedures/", root))).filter((n) => n.endsWith(".md"));
  return Promise.all(
    names.map(async (name) => {
      const raw = await text(`content/procedures/${name}`);
      return { file: name, raw, data: matter(raw, {}).data };
    }),
  );
}

test("the registry holds twelve primers, every one with a sequence, a direction, a target and a reference, and every gap says why", () => {
  assert.equal(rows.length, 12);
  for (const row of rows) {
    assert.ok(row.sequence && /^[ACGT]+$/.test(row.sequence), row.id);
    assert.ok(row.direction && row.target, row.id);
    assert.ok(row.tm !== null && row.length !== null, `${row.id} has a computed Tm and length`);
    assert.ok(row.placement, `${row.id} is placed on its reference (${row.reference})`);
  }
  // What could not be read is waiting for Dustin, each with its reason, and only the literature can be missing.
  const primerGaps = built.gaps.filter((gap) => gap.slug.startsWith("primer/"));
  assert.ok(primerGaps.length > 0);
  for (const gap of primerGaps) {
    assert.match(gap.field, /^published_/, `${gap.slug}.${gap.field}: only a literature fact can be missing`);
    assert.ok(gap.reason.length > 20, `${gap.slug}.${gap.field} says why it is missing`);
  }
});

test("the REV 3' LTR forward primer is CATACTGAGCCAATGGTT and its pair's product is computed as 281 bp, as the protocol stated", () => {
  const forward = byId.get("rev-3-ltr-forward");
  assert.equal(forward?.sequence, "CATACTGAGCCAATGGTT");
  assert.equal(forward?.length, 18);
  const reverse = byId.get("rev-3-ltr-reverse");
  assert.equal(reverse?.sequence, "AATGTTGTACCGAAGTACT");
  assert.equal(mateOf(forward, rows)?.id, "rev-3-ltr-reverse");
  for (const primer of [forward, reverse]) {
    // The product is computed for the pair and shown on both, from both LTRs of DQ387450.1; nothing stores it.
    assert.deepEqual(pairProduct(primer, rows)?.products.map((p) => [p.length, p.start, p.end]), [[281, 258, 538], [281, 8000, 8280]]);
  }
});

test("STORED ONCE: no protocol or page holds a registry primer's sequence, every protocol primer is an id the registry holds, and every registry primer is used", async () => {
  const files = await procedures();
  /** @type {Set<string>} */
  const used = new Set();
  for (const { file, raw, data } of files) {
    for (const row of rows) assert.ok(!raw.includes(row.sequence), `${file} holds the sequence of ${row.id}; it is stored once, in content/registry/primer`);
    if (!Array.isArray(data.primers)) continue;
    for (const p of data.primers) {
      assert.deepEqual(Object.keys(p), ["primer"], `${file}: a protocol names a primer by id and nothing else`);
      assert.ok(byId.has(p.primer), `${file}: ${p.primer} is not in the registry`);
      used.add(p.primer);
    }
  }
  assert.deepEqual(rows.map((r) => r.id).filter((id) => !used.has(id)), [], "a registry primer no protocol uses");
  const pages = (await readdir(new URL("content/pages/", root))).filter((n) => n.endsWith(".md"));
  for (const name of pages) {
    const raw = await text(`content/pages/${name}`);
    for (const row of rows) assert.ok(!raw.includes(row.sequence), `${name} holds the sequence of ${row.id}`);
  }
});

test("a protocol's record carries the registry's facts for the primers it names, in its own order", async () => {
  const { compileDirectory } = await import("../scripts/lib/procedures.mjs");
  const compiled = await compileDirectory("content/procedures");
  const coi = compiled.find((c) => c.slug === "coi-primers")?.compiled;
  assert.ok(coi?.ok, JSON.stringify(coi?.errors));
  assert.deepEqual(coi.record.primers.map((p) => p.id), ["lco1490", "hco2198"]);
  assert.deepEqual(coi.record.primers[0], { id: "lco1490", name: "LCO1490", set: "COI primers: LCO1490 and HCO2198", direction: "forward", sequence: "GGTCAACAAATCATAAAGATATTGG", reference: "X03240.1" });
  const rev = compiled.find((c) => c.slug === "rev-lpdv-primers")?.compiled;
  assert.equal(rev?.ok && rev.record.primers.length, 8);
  assert.ok(rev.markdown.includes("| [REV 3′ LTR forward](/research/lab/primers/rev-3-ltr-forward) | forward | `CATACTGAGCCAATGGTT` | 281 bp |"), "the twin prints the table, with the computed product, from the record");
  assert.ok(rev.markdown.includes("Product sizes are computed from where the primers bind DQ387450.1"), "and says what the sizes were computed from");
});

test("the compile refuses what a protocol may not say about a primer, and refuses a registry it was not given", async () => {
  const { compileProcedure } = await import("../app/lib/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const original = await text("content/procedures/coi-primers.md");
  const compile = (raw, registry = registryHost()) => compileProcedure({ slug: "coi-primers", raw, pipeline, registry });
  assert.equal((await compile(original)).ok, true);

  const unknown = await compile(original.replace("primer: hco2198", "primer: no-such-primer"));
  assert.match(unknown.errors.join("\n"), /primers\[no-such-primer\] names no primer in the lab registry/);
  const twice = await compile(original.replace("primer: hco2198", "primer: lco1490"));
  assert.match(twice.errors.join("\n"), /primers\[lco1490\] is listed twice/);
  const inline = await compile(original.replace("  - { primer: hco2198 }", "  - { primer: hco2198, sequence: TAAACTTCAGGGTGACCAAAAAATCA }"));
  assert.match(inline.errors.join("\n"), /\.sequence is not a protocol field/);
  const old = await compile(original.replace("  - { primer: hco2198 }", "  - { direction: reverse, sequence: TAAACTTCAGGGTGACCAAAAAATCA }"));
  assert.match(old.errors.join("\n"), /is \{ primer: <id> \}/);
  const none = await compileProcedure({ slug: "coi-primers", raw: original, pipeline });
  assert.equal(none.ok, false);
  assert.match(none.errors.join("\n"), /no lab registry/);
});

/* The sizes the protocols STATED before they were computed (the text of the three primer protocols at 2026-10-05, from the
 * papers and the lab's gels). They are kept here as the test that the computed sizes agree with what each protocol states
 * today: a change to a primer, a reference or the alignment code that moves one fails this. Where a stated size is a
 * paper's rounded figure or a gel's reading, the table records it as such and the computed size is held to its own number. */
const STATED_TODAY = [
  { set: "PCR REV 3′ LTR", stated: 281, computed: [281, 281] },
  { set: "PCR REV pol (protease and reverse transcriptase)", stated: 574, computed: [574] },
  { set: "PCR REV pol (reverse transcriptase and integrase)", stated: 801, computed: [801] },
  { set: "PCR LPDV p31/CA", stated: 458, computed: [458] },
  { set: "Pan-avian GAPDH PCR", stated: 534, computed: [534] },
  // Folmer et al. state "about 710 bp" and the lab's gels read about 708 bp; the computed product on X03240.1 is 709 bp, with
  // three mismatches in the forward primer. Reported to the seat 2026-10-05; the protocol keeps its stated 710 and 708.
  { set: "COI primers: LCO1490 and HCO2198", stated: 710, computed: [709], rounded: true },
];

test("the computed product sizes agree with what each protocol states today, and the one that differs is recorded as differing", () => {
  const primerRowsWithProducts = primerRows(primers);
  for (const { set, stated, computed, rounded } of STATED_TODAY) {
    const forward = primerRowsWithProducts.find((row) => row.set === set && row.direction === "forward");
    assert.ok(forward, set);
    assert.deepEqual(forward.product?.products.map((p) => p.length), computed, `${set}: computed`);
    if (rounded) {
      assert.notEqual(computed[0], stated, `${set}: if this now agrees, drop the exception and the prose figure`);
      assert.ok(Math.abs(computed[0] - stated) <= 2, `${set}: within a base or two of the stated figure`);
    } else {
      for (const size of computed) assert.equal(size, stated, `${set}: the computed size equals the stated one`);
    }
  }
});

test("the LPDV product is placed where the protocol said: U09568.1 positions 1041 to 1498", () => {
  const forward = primerRows(primers).find((row) => row.id === "lpdv-p31-ca-forward");
  assert.deepEqual(forward?.product?.products.map((p) => [p.start, p.end]), [[1041, 1498]]);
  assert.equal(forward?.product?.reference.id, "U09568.1");
});

test("the GAPDH product is computed on the chicken genome, not the mRNA, and the turkey genome is a recorded check", async () => {
  const gapdh = primerRows(primers).find((row) => row.id === "gapdh-forward");
  assert.equal(gapdh?.reference, "NC_052532.1:76902320-76906237");
  assert.deepEqual(gapdh?.product?.products.map((p) => [p.length, p.start, p.end]), [[534, 76904235, 76904768]]);
  const { pairProducts } = await import("../app/lib/registry/align.mjs");
  const turkey = pairProducts("GTGGTGCTAAGCGTGTTATCATC", "GGCAGCACCTCTGCCATC", "NC_139404.1:75777043-75780966");
  // The turkey gene is 24 bases shorter between the primers; the lab's positive control is chicken DF-1 cells.
  assert.deepEqual(turkey?.products.map((p) => p.length), [510]);
});

test("what the papers print: every sequence a paper prints equals the stored one, and each that could not be read says why", () => {
  const read = rows.filter((row) => row.publishedSequence);
  assert.deepEqual(read.map((row) => row.id).sort(), ["gapdh-forward", "gapdh-reverse", "hco2198", "lco1490", "lpdv-p31-ca-forward", "lpdv-p31-ca-reverse"]);
  // A difference is never corrected silently: this lists it, by name, for the seat.
  assert.deepEqual(read.filter((row) => row.matchesPublished !== true).map((row) => row.id), []);
  for (const row of rows.filter((r) => !r.publishedSequence)) {
    assert.ok(row.publishedSequenceMissing && row.publishedInMissing, `${row.id} says why its paper was not read`);
    assert.equal(row.matchesPublished, null, `${row.id} has no printed sequence to compare`);
  }
  assert.equal(byId.get("lco1490")?.publishedName, "LCO1490");
  assert.equal(byId.get("hco2198")?.publishedName, "HCO2198");
  assert.equal(byId.get("gapdh-forward")?.publishedDoi, "10.1371/journal.pone.0099678");
  assert.equal(byId.get("lpdv-p31-ca-forward")?.publishedDoi, "10.1016/j.virol.2013.11.037");
});

test("every Tm is computed from the sequence, never stored: no record carries one", async () => {
  const names = (await readdir(new URL("content/registry/primer/", root))).filter((n) => n.endsWith(".md"));
  assert.equal(names.length, 12);
  for (const name of names) {
    const data = matter(await text(`content/registry/primer/${name}`), {}).data;
    for (const field of ["tm", "Tm", "length", "gc", "reverse_complement", "protocols", "product", "position", "start", "end", "strand", "mismatches", "published_matches"]) assert.equal(Object.hasOwn(data, field), false, `${name} stores ${field}`);
    assert.equal(primerFacts(data.sequence).tm, primerTm(data.sequence) === null ? null : Math.round(primerTm(data.sequence) * 10) / 10);
  }
});

test("the kind refuses what is wrong, with the field named", async () => {
  const kinds = { primer: PRIMER };
  const host = { paper: async (slug) => slug === "real-paper" };
  const compile = (slug, lines) => compileRegistryItem({ slug, raw: `---\n${lines.join("\n")}\n---\n`, host, pipeline: { findWideDashes }, kinds });
  const good = ["name: X forward", "sequence: ACGTACGTACGT", "direction: forward", "target: X", "published_in: A paper", "published_name: X", "published_sequence: ACGTACGTACGT"];
  assert.equal((await compile("primer/x-forward", good)).ok, true);
  const bad = await compile("primer/x-forward", ["name: X forward", "sequence: acgtacgtacgt", "direction: sideways", "target: X", "published_product: 12 base pairs", "published_url: http://nope", "published_doi: nope", "reference: NOT_A_REFERENCE.1", "published_sequence: tttt"]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of ["sequence:", "direction:", "published_product:", "published_url:", "published_doi:", "reference:", "published_sequence:"]) assert.ok(message.includes(field), field);
  const short = await compile("primer/x-forward", ["name: X", "sequence: ACGT", "direction: forward", "target: X", "published_in: A paper", "published_name: X", "published_sequence: ACGTACGTACGT"]);
  assert.match(short.errors.join("\n"), /is 10 to 80 bases/);
  const gap = await compile("primer/x-forward", ["name: X", 'sequence: "MISSING: not recorded"', "direction: forward", "target: X", "published_in: A paper", "published_name: X", "published_sequence: ACGTACGTACGT"]);
  assert.equal(gap.ok, true);
  assert.equal(primerRow({ ...gap.item }).tm, null, "a gap has no Tm");
});

test("the set rules: a sequence is stored once, a set has one forward and one reverse, a product is on the forward primer", () => {
  const item = (id, fields) => ({ kind: "primer", id, name: id, status: "published", fields: { target: "T", ...fields } });
  const set = (...items) => registrySetErrors(items, { primer: PRIMER }).join("\n");
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward" }), item("b", { sequence: "ACGTACGTACGT", direction: "reverse" })), /hold the same sequence/);
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward", set: "S" }), item("b", { sequence: "TTGGCCAATTGG", direction: "forward", set: "S" })), /2 forward primers/);
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "reverse", published_product: "100 bp" })), /stated on its forward primer/);
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward", set: "S", reference: "DQ387450.1" }), item("b", { sequence: "TTGGCCAATTGG", direction: "reverse", set: "S", reference: "U09568.1" })), /names 2 references/);
  assert.equal(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward", set: "S", published_product: "100 bp", reference: "DQ387450.1" }), item("b", { sequence: "TTGGCCAATTGG", direction: "reverse", set: "S", reference: "DQ387450.1" })), "");
});

test("addresses: the kind's page is its plural, an item sits under it, and a segment maps back to its kind", () => {
  assert.equal(kindPath("primer"), "/research/lab/primers");
  assert.equal(itemPath("primer", "lco1490"), "/research/lab/primers/lco1490");
  assert.equal(kindFromSegment("primers"), "primer");
  assert.equal(kindFromSegment("primer"), null);
  assert.equal(kindFromSegment("strains"), "strain");
  assert.deepEqual(Object.keys(KINDS), ["primer", "strain"]);
});

test("the inventory is the registry's items and the phages, the phages read and never copied, the lab's own records first", () => {
  const phages = [
    { name: "Acorn15", year: 2017, host: "smegmatis", county: "Hood County" },
    { name: "Zeta", year: 2026, host: null, county: null },
  ];
  const inventory = inventoryRows(built.items, phages);
  assert.equal(inventory.length, 16, "twelve primers, two strains and two phages");
  assert.equal(inventory.filter((r) => r.kind === "phage").length, 2);
  const acorn = inventory.find((r) => r.name === "Acorn15");
  assert.equal(acorn?.path, "/research/phages#acorn15");
  assert.equal(acorn?.summary, "found in 2017, M. smegmatis mc²155, Hood County");
  assert.equal(inventory.find((r) => r.key === "strain/foliorum")?.summary, "Microbacterium foliorum, NRRL B-24224");
  assert.equal(inventory.find((r) => r.name === "Zeta")?.summary, "found in 2026");
  assert.equal(inventory.find((r) => r.key === "primer/lco1490")?.summary, "forward primer, COI (cytochrome c oxidase subunit I), 25 nt");
  // The catalog orders the registry's kinds before the phages by default.
  const sorted = [...inventory].sort(INVENTORY.fields.find((f) => f.key === "kind").sort.compare);
  assert.equal(sorted[0].kind, "primer");
  assert.equal(sorted.at(-1).kind, "phage");
  assert.equal(PRIMERS.fields.find((f) => f.key === "tm")?.type, "number");
});

test("a protocol uses a primer when it names its id; none is listed on the primer", () => {
  const lco = byId.get("lco1490");
  const protocols = [
    { path: "/research/protocols/coi-primers", title: "COI", primers: [{ id: "lco1490" }] },
    { path: "/research/protocols/other", title: "Other", primers: [{ id: "hco2198" }] },
  ];
  assert.deepEqual(protocolsUsing(lco, protocols), [{ path: "/research/protocols/coi-primers", title: "COI" }]);
});

test("the library gets a Primers tab with the count, only while a primer exists", () => {
  const tabs = libraryTabs([], [], registryTabs(primers));
  assert.deepEqual(tabs.at(-1), { id: "primers", label: "Primers", count: 12, href: "/research/lab/primers", current: false });
  assert.equal(tabs.at(-2)?.id, "calculators", "the registry's tabs follow the calculators");
  assert.equal(libraryTabs([], [], registryTabs([])).at(-1)?.id, "calculators");
  assert.deepEqual(registryTabs(primers), [{ id: "primers", label: "Primers", count: 12, href: "/research/lab/primers" }]);
  assert.deepEqual(registryTabs([]), []);
});
