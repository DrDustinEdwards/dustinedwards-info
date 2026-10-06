import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import matter from "gray-matter";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import {
  EQUIPMENT_CATALOG,
  equipmentGapText,
  equipmentMarkdown,
  equipmentRow,
  equipmentRows,
  equipmentUses,
  hasItemPage,
  inventoryRows,
  kindPath,
} from "../app/lib/registry/catalog.mjs";
import { compileRegistryItem } from "../app/lib/registry/compile.mjs";
import { EQUIPMENT } from "../app/lib/registry/equipment.mjs";
import { KINDS } from "../app/lib/registry/kinds.mjs";
import { registrySearchInput } from "../app/lib/registry/search-inputs.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The equipment kind (docs/REGISTRY.md): the instruments and labware the protocols list, held as one table with no page for an item,
 * who makes each (a gap until a record says), a centrifuge's rotor (a gap until Dustin names it), and the protocols that use each. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const items = built.items.filter((item) => item.kind === "equipment");
const byId = new Map(items.map((item) => [item.id, item]));

test("the registry holds the equipment the protocols list, each a name and a maker nobody has recorded yet", () => {
  assert.equal(KINDS.equipment, EQUIPMENT);
  assert.deepEqual([...byId.keys()].sort(), [
    "heat-block",
    "light-box",
    "microcentrifuge",
    "microcentrifuge-tubes",
    "nanodrop",
    "pipettor",
    "plate-incubator",
    "qubit-3-0",
    "shaking-incubator",
    "vacuum-filter-unit",
    "water-bath",
  ]);
  const gaps = built.gaps.filter((gap) => gap.slug.startsWith("equipment/"));
  assert.equal(gaps.filter((g) => g.field === "manufacturer").length, 11, "no record in the repo says who makes any of it");
  for (const gap of gaps) assert.ok(["manufacturer", "rotor"].includes(gap.field) && gap.reason.length > 20, `${gap.slug}.${gap.field}`);
  const centrifuge = equipmentRow(byId.get("microcentrifuge"));
  assert.equal(centrifuge.rotor, null);
  assert.match(centrifuge.rotorMissing ?? "", /Waiting on Dustin: the ZnCl2 rotor \(core\.md\)/);
  assert.equal(equipmentGapText(centrifuge).length, 2, "the maker and the rotor are both gaps on a centrifuge");
  assert.equal(equipmentGapText(equipmentRow(byId.get("water-bath"))).length, 1);
  assert.equal(equipmentRow(byId.get("qubit-3-0")).name, "Qubit 3.0");
});

test("the kind refuses what is wrong, with the field named", async () => {
  const kinds = { equipment: EQUIPMENT };
  const host = { paper: async () => false, recipe: async () => false };
  const compile = (lines) => compileRegistryItem({ slug: "equipment/x", raw: `---\n${lines.join("\n")}\n---\n`, host, pipeline: { findWideDashes }, kinds });
  assert.equal((await compile(["name: X", "manufacturer: A maker"])).ok, true);
  assert.equal((await compile(["name: X", 'manufacturer: "MISSING: no record"', 'rotor: "MISSING: waiting"'])).ok, true);
  const bad = await compile(["name: X", "rotor: 12"]);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.join("\n").includes("manufacturer") && bad.errors.join("\n").includes("rotor"));
});

test("an item has no page, no twin, no search record and no sitemap entry: the table is the page", () => {
  assert.equal(EQUIPMENT.itemPages, false);
  assert.equal(hasItemPage("equipment"), false);
  assert.equal(registrySearchInput(byId.get("water-bath")), null);
  assert.ok(inventoryRows(items, []).every((row) => row.path === kindPath("equipment")));
  assert.equal(kindPath("equipment"), "/research/lab/equipment");
});

test("no record stores what is computed: the protocols that use an item, or the setting a protocol gives it", async () => {
  const names = (await readdir(new URL("content/registry/equipment/", root))).filter((n) => n.endsWith(".md"));
  assert.equal(names.length, 11);
  for (const name of names) {
    const data = matter(await text(`content/registry/equipment/${name}`), {}).data;
    for (const field of ["protocols", "used_in", "temperature", "speed", "setting", "volume"]) assert.equal(Object.hasOwn(data, field), false, `${name} stores ${field}`);
  }
});

test("the table lists each item's protocols, read from the protocols that name it, and every gap with its reason", () => {
  const protocols = [
    { path: "/research/protocols/a", title: "A", equipment: [{ name: "55 °C water bath", item: { id: "water-bath" } }, { name: "gel", item: null }] },
    { path: "/research/protocols/b", title: "B", equipment: [{ name: "plain", item: null }] },
    { path: "/research/protocols/c" },
  ];
  assert.deepEqual(equipmentUses("water-bath", protocols), [{ path: "/research/protocols/a", title: "A" }]);
  const rows = equipmentRows(items, protocols);
  assert.equal(EQUIPMENT_CATALOG.fields.find((f) => f.key === "protocols").value(rows.find((r) => r.id === "water-bath")), "A");
  const md = equipmentMarkdown(rows, "https://example.com");
  for (const line of [
    "| Equipment | Manufacturer | Rotor | Protocols |",
    "| Water bath |",
    "[A](https://example.com/research/protocols/a)",
    "Not found:",
    "- Water bath, manufacturer: No record in the repo states who makes the lab's water bath.",
    "- Microcentrifuge, rotor: Waiting on Dustin: the ZnCl2 rotor (core.md).",
  ]) {
    assert.ok(md.includes(line), line);
  }
});

test("a protocol's Equipment table is drawn from the registry beside the protocol's own words", async () => {
  const { compileDirectory } = await import("../scripts/lib/procedures.mjs");
  const compiled = await compileDirectory("content/procedures");
  const extraction = compiled.find((c) => c.slug === "phage-dna-extraction")?.compiled;
  assert.ok(extraction?.ok, JSON.stringify(extraction?.errors));
  const centrifuge = extraction.record.equipment.find((e) => e.name === "microcentrifuge");
  assert.deepEqual(centrifuge.item, { id: "microcentrifuge", name: "Microcentrifuge", status: "published", manufacturer: null, rotor: null, rotorGap: true });
  assert.ok(extraction.markdown.includes("- microcentrifuge (manufacturer not recorded; rotor not recorded)"), "the twin carries the same facts");
  const isolation = compiled.find((c) => c.slug === "phage-isolation")?.compiled;
  assert.ok(isolation.record.equipment.some((e) => e.name === "55 °C water bath for molten top agar" && e.item?.id === "water-bath"), "the protocol keeps its own words");
  const coi = compiled.find((c) => c.slug === "coi-primers")?.compiled;
  assert.ok(coi.record.equipment.every((e) => e.item === null), "an item no record holds (a gel) stays the protocol's own");
});

test("the compile refuses what a protocol may not say about equipment", async () => {
  const { compileProcedure } = await import("../app/lib/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const original = await text("content/procedures/phage-dna-extraction.md");
  const compile = (raw, registry = registryHost()) => compileProcedure({ slug: "phage-dna-extraction", raw, pipeline, registry });
  assert.equal((await compile(original)).ok, true);
  const unknown = await compile(original.replace("equipment: heat-block", "equipment: no-such-item"));
  assert.match(unknown.errors.join("\n"), /equipment\[heat block\]\.equipment names no equipment in the lab registry/);
  const bad = await compile(original.replace("equipment: heat-block", "equipment: Not An Id"));
  assert.match(bad.errors.join("\n"), /\.equipment is the id of an equipment item in the lab registry/);
  const none = await compileProcedure({ slug: "phage-dna-extraction", raw: original, pipeline });
  assert.equal(none.ok, false);
  assert.match(none.errors.join("\n"), /no lab registry/);
});
