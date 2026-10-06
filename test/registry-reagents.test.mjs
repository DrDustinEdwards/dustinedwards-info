import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import matter from "gray-matter";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { REAGENTS, itemPath, reagentMarkdown, reagentRow, reagentRows, reagentUses, reagentsMarkdown, useText } from "../app/lib/registry/catalog.mjs";
import { compileRegistryItem } from "../app/lib/registry/compile.mjs";
import { KINDS } from "../app/lib/registry/kinds.mjs";
import { REAGENT } from "../app/lib/registry/reagent.mjs";
import { registrySearchInput } from "../app/lib/registry/search-inputs.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The reagent kind (docs/REGISTRY.md): the substances the lab's protocols use, what is computed from the protocols that name
 * them, and the guard that holds a product's supplier, catalog number and page to the registry, so each is stored once. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const reagents = built.items.filter((item) => item.kind === "reagent");
const byId = new Map(reagents.map((item) => [item.id, item]));

test("the registry holds the reagents the lab's protocols use, stating only what a record in the repo states", () => {
  assert.equal(reagents.length, 15);
  assert.equal(KINDS.reagent, REAGENT);
  const rows = new Map(reagentRows(reagents, []).map((row) => [row.id, row]));
  const gotaq = rows.get("gotaq-flexi-dna-polymerase");
  assert.deepEqual(
    [gotaq?.name, gotaq?.supplier, gotaq?.catalogNumber, gotaq?.productUrl],
    ["GoTaq® Flexi DNA polymerase", "Promega", "M8296", "https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296"],
  );
  const onetaq = rows.get("onetaq-hot-start-2x-master-mix");
  assert.deepEqual([onetaq?.supplier, onetaq?.catalogNumber], ["New England Biolabs", "M0484"]);
  assert.equal(rows.get("zinc-chloride")?.abbreviation, "ZnCl2");
  assert.equal(rows.get("nuclease-mix")?.contents, "DNase I plus RNase A");
});

test("a supplier or catalog number no record states is a gap that says why, and only those are gaps", () => {
  const gaps = built.gaps.filter((gap) => gap.slug.startsWith("reagent/"));
  assert.equal(gaps.length, 26, "thirteen reagents, a supplier and a catalog number each");
  for (const gap of gaps) {
    assert.ok(["supplier", "catalog_number"].includes(gap.field), `${gap.slug}.${gap.field}: only a supplier or a catalog number can be missing`);
    assert.match(gap.reason, /No record in the repo states/);
  }
  const stated = new Set(["gotaq-flexi-dna-polymerase", "onetaq-hot-start-2x-master-mix"]);
  for (const id of byId.keys()) assert.equal(gaps.some((g) => g.slug === `reagent/${id}`), !stated.has(id), id);
  const row = reagentRow(byId.get("proteinase-k"));
  assert.equal(row.supplier, null);
  assert.match(row.supplierMissing ?? "", /who supplies the lab's proteinase K/);
});

test("the kind refuses what is wrong, with the field named", async () => {
  const kinds = { reagent: REAGENT };
  const host = { paper: async () => false };
  const compile = (lines) => compileRegistryItem({ slug: "reagent/x", raw: `---\n${lines.join("\n")}\n---\n`, host, pipeline: { findWideDashes }, kinds });
  assert.equal((await compile(["name: X", "supplier: A supplier", "catalog_number: C1"])).ok, true);
  const bad = await compile(["name: X", "product_url: http://nope", "abbreviation: 12"]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of ["supplier", "catalog_number", "product_url", "abbreviation"]) assert.ok(message.includes(field), field);
});

test("no record stores what is computed: the protocols that use a reagent, or the amounts they use", async () => {
  const names = (await readdir(new URL("content/registry/reagent/", root))).filter((n) => n.endsWith(".md"));
  assert.equal(names.length, 15);
  for (const name of names) {
    const data = matter(await text(`content/registry/reagent/${name}`), {}).data;
    for (const field of ["protocols", "used_in", "stock", "final", "amount", "per"]) assert.equal(Object.hasOwn(data, field), false, `${name} stores ${field}`);
  }
});

test("what the protocols use of a reagent is read from the protocols that name it", () => {
  const protocols = [
    {
      path: "/research/protocols/a",
      title: "A",
      materials: [
        { reagent: { id: "zinc-chloride" }, stock: ["2 M"], final: "40 mM", amount: "20 µl", per: "tube", group: null },
        { reagent: { id: "ethanol" }, stock: ["70%"], final: null, amount: "250 µl", per: "wash", group: null },
        { reagent: { id: "ethanol" }, stock: ["100%"], final: null, amount: null, per: null, group: "Rescue" },
      ],
    },
    { path: "/research/protocols/b", title: "B", materials: [{ reagent: null, stock: [], final: null, amount: null, per: null }] },
    { path: "/research/protocols/c", title: "C" },
  ];
  assert.deepEqual(reagentUses("zinc-chloride", protocols).map((u) => [u.path, u.rows.length]), [["/research/protocols/a", 1]]);
  const ethanol = reagentUses("ethanol", protocols);
  assert.deepEqual(ethanol.map((u) => u.rows.length), [2]);
  assert.equal(useText(ethanol[0].rows[0]), "stock 70%; 250 µl per wash");
  assert.equal(useText(ethanol[0].rows[1]), "stock 100%; (Rescue)");
  assert.equal(REAGENTS.fields.find((f) => f.key === "protocols").value(reagentRow(byId.get("ethanol"), protocols)), 1);
});

test("the twin states what the page states, with what nobody recorded said with its reason", () => {
  const protocols = [{ path: "/research/protocols/a", title: "A", materials: [{ reagent: { id: "zinc-chloride" }, stock: ["2 M"], final: "40 mM", amount: "20 µl", per: "tube", group: null }] }];
  const md = reagentMarkdown(reagentRow(byId.get("zinc-chloride"), protocols), "https://example.com");
  for (const line of [
    "# Zinc chloride",
    "- Abbreviation: ZnCl2",
    "- Supplier: not found (No record in the repo states who supplies the lab's zinc chloride.)",
    "- [A](https://example.com/research/protocols/a)",
    "  - stock 2 M; final 40 mM; 20 µl per tube",
  ]) assert.ok(md.includes(line), line);
  const gotaq = reagentMarkdown(reagentRow(byId.get("gotaq-flexi-dna-polymerase"), []), "https://example.com");
  assert.ok(gotaq.includes("- Supplier: Promega") && gotaq.includes("- Catalog number: M8296") && gotaq.includes("No published protocol names this reagent."));
  assert.ok(reagentsMarkdown(reagentRows(reagents, []), "https://example.com").includes("| [Zinc chloride](https://example.com/research/lab/reagents/zinc-chloride) |"));
  assert.equal(itemPath("reagent", "zinc-chloride"), "/research/lab/reagents/zinc-chloride");
});

test("a reagent is found by its name, abbreviation, supplier and catalog number", () => {
  const found = registrySearchInput(byId.get("gotaq-flexi-dna-polymerase"));
  assert.equal(found?.uid, "registry:reagent/gotaq-flexi-dna-polymerase");
  for (const word of ["GoTaq", "Promega", "M8296"]) assert.ok(found?.body.includes(word), word);
  assert.ok(registrySearchInput(byId.get("zinc-chloride"))?.body.includes("ZnCl2"));
});

test("STORED ONCE: no protocol types a reagent's catalog number or product page, and every reagent a material names is one the registry holds", async () => {
  const { compileDirectory } = await import("../scripts/lib/procedures.mjs");
  const compiled = await compileDirectory("content/procedures");
  const typed = reagents.flatMap((r) => [r.fields.product_url, r.fields.catalog_number].filter((v) => typeof v === "string" && !v.startsWith("MISSING")));
  assert.ok(typed.length >= 4);
  const used = new Set();
  for (const name of (await readdir(new URL("content/procedures/", root))).filter((n) => n.endsWith(".md"))) {
    const raw = await text(`content/procedures/${name}`);
    for (const value of typed) assert.ok(!raw.includes(value), `${name} types "${value}"; it is stored once, in content/registry/reagent`);
    const data = matter(raw, {}).data;
    for (const material of data.materials ?? []) {
      if (material.reagent === undefined) continue;
      assert.ok(byId.has(material.reagent), `${name}: ${material.reagent} is not in the registry`);
      used.add(material.reagent);
    }
  }
  assert.deepEqual([...byId.keys()].filter((id) => !used.has(id)), [], "a registry reagent no protocol uses");
  const coi = compiled.find((c) => c.slug === "coi-primers")?.compiled;
  assert.ok(coi?.ok, JSON.stringify(coi?.errors));
  assert.deepEqual(coi.record.materials[0].reagent, { id: "gotaq-flexi-dna-polymerase", name: "GoTaq® Flexi DNA polymerase", path: "/research/lab/reagents/gotaq-flexi-dna-polymerase" });
  assert.equal(coi.record.materials[0].display, "GoTaq® Flexi DNA polymerase");
  const extraction = compiled.find((c) => c.slug === "phage-dna-extraction")?.compiled;
  assert.ok(extraction?.ok, JSON.stringify(extraction?.errors));
  assert.ok(extraction.markdown.includes("[ZnCl2](/research/lab/reagents/zinc-chloride)"), "the twin links the reagent");
});

test("the compile refuses what a protocol may not say about a reagent", async () => {
  const { compileProcedure } = await import("../app/lib/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const original = await text("content/procedures/coi-primers.md");
  const compile = (raw, registry = registryHost()) => compileProcedure({ slug: "coi-primers", raw, pipeline, registry });
  assert.equal((await compile(original)).ok, true);
  const unknown = await compile(original.replace("reagent: gotaq-flexi-dna-polymerase", "reagent: no-such-reagent"));
  assert.match(unknown.errors.join("\n"), /materials\[GoTaq Flexi DNA polymerase\]\.reagent names no reagent in the lab registry/);
  const bad = await compile(original.replace("reagent: gotaq-flexi-dna-polymerase", "reagent: Not An Id"));
  assert.match(bad.errors.join("\n"), /\.reagent is the id of a reagent in the lab registry/);
  const none = await compileProcedure({ slug: "coi-primers", raw: original, pipeline });
  assert.equal(none.ok, false);
  assert.match(none.errors.join("\n"), /no lab registry/);
});
