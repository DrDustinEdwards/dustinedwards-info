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
const rows = built.items.map(primerRow);
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

test("the registry holds twelve primers, every one with a sequence, a direction and a target, and no gap waiting", () => {
  assert.equal(rows.length, 12);
  assert.deepEqual(built.gaps, []);
  for (const row of rows) {
    assert.ok(row.sequence && /^[ACGT]+$/.test(row.sequence), row.id);
    assert.ok(row.direction && row.target, row.id);
    assert.ok(row.tm !== null && row.length !== null, `${row.id} has a computed Tm and length`);
  }
});

test("the REV 3' LTR forward primer is CATACTGAGCCAATGGTT, its pair's product 281 bp, as the protocol states", () => {
  const forward = byId.get("rev-3-ltr-forward");
  assert.equal(forward?.sequence, "CATACTGAGCCAATGGTT");
  assert.equal(forward?.product, "281 bp");
  assert.equal(forward?.length, 18);
  const reverse = byId.get("rev-3-ltr-reverse");
  assert.equal(reverse?.sequence, "AATGTTGTACCGAAGTACT");
  assert.equal(reverse?.product, null, "a product is stated once, on the forward primer");
  assert.equal(pairProduct(reverse, rows), "281 bp", "and shown on the reverse through its pair");
  assert.equal(mateOf(forward, rows)?.id, "rev-3-ltr-reverse");
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
  assert.deepEqual(coi.record.primers[0], { id: "lco1490", name: "LCO1490", set: "COI primers: LCO1490 and HCO2198", direction: "forward", sequence: "GGTCAACAAATCATAAAGATATTGG" });
  const rev = compiled.find((c) => c.slug === "rev-lpdv-primers")?.compiled;
  assert.equal(rev?.ok && rev.record.primers.length, 8);
  assert.ok(rev.markdown.includes("| [REV 3′ LTR forward](/research/lab/primers/rev-3-ltr-forward) | forward | `CATACTGAGCCAATGGTT` |"), "the twin prints the table from the record");
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

test("a product is stated only where a protocol states it: its size is in the text of a protocol that uses the pair", async () => {
  const files = await procedures();
  for (const row of rows.filter((r) => r.product)) {
    const stated = row.product.replace(/^about /, "");
    const using = files.filter((f) => Array.isArray(f.data.primers) && f.data.primers.some((p) => p.primer === row.id));
    assert.ok(using.length > 0, `${row.id} is used by a protocol`);
    assert.ok(using.some((f) => f.raw.includes(stated)), `${row.id}: no protocol that uses it says ${stated}`);
  }
  // COI and GAPDH carry a product and the reverse primers carry none.
  assert.deepEqual(rows.filter((r) => r.direction === "reverse" && r.product), []);
});

test("every Tm is computed from the sequence, never stored: no record carries one", async () => {
  const names = (await readdir(new URL("content/registry/primer/", root))).filter((n) => n.endsWith(".md"));
  assert.equal(names.length, 12);
  for (const name of names) {
    const data = matter(await text(`content/registry/primer/${name}`), {}).data;
    for (const field of ["tm", "Tm", "length", "gc", "reverse_complement", "protocols"]) assert.equal(Object.hasOwn(data, field), false, `${name} stores ${field}`);
    assert.equal(primerFacts(data.sequence).tm, primerTm(data.sequence) === null ? null : Math.round(primerTm(data.sequence) * 10) / 10);
  }
});

test("the kind refuses what is wrong, with the field named", async () => {
  const kinds = { primer: PRIMER };
  const host = { paper: async (slug) => slug === "real-paper" };
  const compile = (slug, lines) => compileRegistryItem({ slug, raw: `---\n${lines.join("\n")}\n---\n`, host, pipeline: { findWideDashes }, kinds });
  const good = ["name: X forward", "sequence: ACGTACGTACGT", "direction: forward", "target: X"];
  assert.equal((await compile("primer/x-forward", good)).ok, true);
  const bad = await compile("primer/x-forward", ["name: X forward", "sequence: acgtacgtacgt", "direction: sideways", "target: X", "product: 12 base pairs", "source_url: http://nope", "paper: not-a-paper"]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of ["sequence:", "direction:", "product:", "source_url:", "paper:"]) assert.ok(message.includes(field), field);
  const short = await compile("primer/x-forward", ["name: X", "sequence: ACGT", "direction: forward", "target: X"]);
  assert.match(short.errors.join("\n"), /is 10 to 80 bases/);
  const gap = await compile("primer/x-forward", ["name: X", 'sequence: "MISSING: not recorded"', "direction: forward", "target: X"]);
  assert.equal(gap.ok, true);
  assert.equal(primerRow({ ...gap.item }).tm, null, "a gap has no Tm");
});

test("the set rules: a sequence is stored once, a set has one forward and one reverse, a product is on the forward primer", () => {
  const item = (id, fields) => ({ kind: "primer", id, name: id, status: "published", fields: { target: "T", ...fields } });
  const set = (...items) => registrySetErrors(items, { primer: PRIMER }).join("\n");
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward" }), item("b", { sequence: "ACGTACGTACGT", direction: "reverse" })), /hold the same sequence/);
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward", set: "S" }), item("b", { sequence: "TTGGCCAATTGG", direction: "forward", set: "S" })), /2 forward primers/);
  assert.match(set(item("a", { sequence: "ACGTACGTACGT", direction: "reverse", product: "100 bp" })), /stated on its forward primer/);
  assert.equal(set(item("a", { sequence: "ACGTACGTACGT", direction: "forward", set: "S", product: "100 bp" }), item("b", { sequence: "TTGGCCAATTGG", direction: "reverse", set: "S" })), "");
});

test("addresses: the kind's page is its plural, an item sits under it, and a segment maps back to its kind", () => {
  assert.equal(kindPath("primer"), "/research/lab/primers");
  assert.equal(itemPath("primer", "lco1490"), "/research/lab/primers/lco1490");
  assert.equal(kindFromSegment("primers"), "primer");
  assert.equal(kindFromSegment("primer"), null);
  assert.equal(kindFromSegment("strains"), null, "no strain kind yet");
  assert.deepEqual(Object.keys(KINDS), ["primer"]);
});

test("the inventory is the registry's items and the phages, the phages read and never copied, the lab's own records first", () => {
  const phages = [
    { name: "Acorn15", year: 2017, host: "smegmatis", county: "Hood County" },
    { name: "Zeta", year: 2026, host: null, county: null },
  ];
  const inventory = inventoryRows(built.items, phages);
  assert.equal(inventory.length, 14);
  assert.equal(inventory.filter((r) => r.kind === "phage").length, 2);
  const acorn = inventory.find((r) => r.name === "Acorn15");
  assert.equal(acorn?.path, "/research/phages#acorn15");
  assert.equal(acorn?.summary, "found in 2017, M. smegmatis mc²155, Hood County");
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
  const tabs = libraryTabs([], [], registryTabs(built.items));
  assert.deepEqual(tabs.at(-1), { id: "primers", label: "Primers", count: 12, href: "/research/lab/primers", current: false });
  assert.equal(tabs.at(-2)?.id, "calculators", "the registry's tabs follow the calculators");
  assert.equal(libraryTabs([], [], registryTabs([])).at(-1)?.id, "calculators");
  assert.deepEqual(registryTabs(built.items), [{ id: "primers", label: "Primers", count: 12, href: "/research/lab/primers" }]);
  assert.deepEqual(registryTabs([]), []);
});
