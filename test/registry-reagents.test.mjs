import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import matter from "gray-matter";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { reagentSource } from "../app/kb/procedures/render.mjs";
import {
  REAGENTS,
  hasItemPage,
  inventoryRows,
  kindPath,
  reagentGapText,
  reagentLabel,
  reagentRow,
  reagentRows,
  reagentUses,
  reagentsMarkdown,
} from "../app/kb/registry/catalog.mjs";
import { compileRegistryItem, registrySetErrors } from "../app/kb/registry/compile.mjs";
import { KINDS } from "../app/kb/registry/kinds.mjs";
import { REAGENT } from "../app/kb/registry/reagent.mjs";
import { registrySearchInput } from "../app/kb/registry/search-inputs.mjs";
import { buildRegistry, repoHost } from "../scripts/lib/registry.mjs";

/* The reagent kind (docs/REGISTRY.md): the substances the lab's protocols use, held as one table with a page for each item (A1); what a
 * reagent is bought from or how the lab prepares it; and the guard that holds a product's supplier, catalog number and page to the
 * registry, so each is stored once. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const reagents = built.items.filter((item) => item.kind === "reagent");
const byId = new Map(reagents.map((item) => [item.id, item]));
const PREPARED = ["nuclease-mix", "phage-buffer", "pyca", "tes-buffer"];

test("the registry holds the reagents the lab's protocols use, stating only what a record in the repo states", () => {
  assert.equal(reagents.length, 16);
  assert.equal(KINDS.reagent, REAGENT);
  const rows = new Map(reagentRows(reagents, []).map((row) => [row.id, row]));
  const gotaq = rows.get("gotaq-flexi-dna-polymerase");
  assert.deepEqual(
    [gotaq?.name, gotaq?.supplier, gotaq?.catalogNumber, gotaq?.productUrl],
    ["GoTaq® Flexi DNA polymerase", "Promega", "M8296", "https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296"],
  );
  const onetaq = rows.get("onetaq-hot-start-2x-master-mix");
  assert.deepEqual([onetaq?.supplier, onetaq?.catalogNumber], ["New England Biolabs", "M0484"]);
  const ladder = rows.get("neb-100-bp-dna-ladder");
  assert.deepEqual([ladder?.name, ladder?.supplier, ladder?.catalogNumber, ladder?.productUrl], ["100 bp DNA ladder", "New England Biolabs", "N3231", "https://www.neb.com/products/n3231-100-bp-dna-ladder"]);
  assert.equal(reagentLabel(rows.get("zinc-chloride")), "Zinc chloride (ZnCl2)");
  assert.equal(reagentLabel(rows.get("nuclease-mix")), "Nuclease mix (DNase I plus RNase A)");
});

test("a reagent is bought or prepared in the lab, and what no record states is a gap that says why", () => {
  for (const id of PREPARED) {
    const row = reagentRow(byId.get(id));
    assert.equal(row.preparedInLab, true, id);
    assert.deepEqual([row.supplier, row.catalogNumber, row.productUrl, row.recipe], [null, null, null, null], `${id} has no supplier, number, product link or recipe`);
    assert.match(row.recipeMissing ?? "", /No procedure with the recipe profile exists yet/);
    assert.deepEqual(reagentGapText(row).length, 1);
  }
  const gaps = built.gaps.filter((gap) => gap.slug.startsWith("reagent/"));
  const bought = [...byId.keys()].filter((id) => !PREPARED.includes(id) && !["gotaq-flexi-dna-polymerase", "onetaq-hot-start-2x-master-mix", "neb-100-bp-dna-ladder"].includes(id));
  assert.equal(bought.length, 9);
  assert.equal(gaps.length, bought.length * 2 + PREPARED.length, "a supplier and a catalog number for each bought reagent nobody records, a recipe for each prepared one");
  for (const gap of gaps) {
    assert.ok(["supplier", "catalog_number", "recipe"].includes(gap.field), `${gap.slug}.${gap.field}`);
    assert.ok(gap.reason.length > 20, `${gap.slug}.${gap.field} says why`);
  }
  const proteinase = reagentRow(byId.get("proteinase-k"));
  assert.equal(proteinase.supplier, null);
  assert.match(proteinase.supplierMissing ?? "", /who supplies the lab's proteinase K/);
});

test("the kind refuses what is wrong, with the field named, and holds a reagent to bought or prepared", async () => {
  const kinds = { reagent: REAGENT };
  const host = { paper: async () => false, recipe: async (slug) => slug === "phage-buffer-recipe" };
  const compile = (lines) => compileRegistryItem({ slug: "reagent/x", raw: `---\n${lines.join("\n")}\n---\n`, host, pipeline: { findWideDashes }, kinds });
  assert.equal((await compile(["name: X", "supplier: A supplier", "catalog_number: C1"])).ok, true);
  assert.equal((await compile(["name: X", "prepared_in_lab: true", "recipe: phage-buffer-recipe"])).ok, true, "a recipe that exists");
  const bad = await compile(["name: X", "product_url: http://nope", "abbreviation: 12", "prepared_in_lab: false", "recipe: no-such-recipe"]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of ["product_url", "abbreviation", "prepared_in_lab", "recipe"]) assert.ok(message.includes(field), field);
  const item = (id, fields) => ({ kind: "reagent", id, name: id, status: "published", fields: { abbreviation: null, contents: null, product_url: null, prepared_in_lab: null, recipe: null, supplier: null, catalog_number: null, ...fields } });
  const set = (...items) => registrySetErrors(items, kinds).join("\n");
  assert.match(set(item("a", {})), /reagent\/a is bought, so it states its supplier/);
  assert.match(set(item("a", { supplier: "S", catalog_number: "C", recipe: "x" })), /not prepared in the lab, so it has no recipe/);
  assert.match(set(item("a", { prepared_in_lab: true })), /prepared in the lab, so it states its recipe/);
  assert.match(set(item("a", { prepared_in_lab: true, recipe: "MISSING: not yet", supplier: "S" })), /prepared in the lab, so it has no supplier/);
  assert.equal(set(item("a", { prepared_in_lab: true, recipe: "MISSING: not yet" }), item("b", { supplier: "MISSING: why", catalog_number: "MISSING: why" })), "");
});

test("the recipe a reagent links is a procedure with the recipe profile, as the repository holds it", async () => {
  assert.equal(await repoHost.recipe("phage-isolation"), false, "a protocol is not a recipe");
  assert.equal(await repoHost.recipe("no-such-procedure"), false);
});

test("a reagent has a page of its own, found by search and from the inventory (docs/KNOWLEDGE-BASE.md, A1)", () => {
  assert.equal(hasItemPage("reagent"), true);
  const input = registrySearchInput(byId.get("gotaq-flexi-dna-polymerase"));
  assert.equal(input?.url, "/research/lab/reagents/gotaq-flexi-dna-polymerase");
  assert.match(input?.body ?? "", /reagent .*Promega M8296/);
  // A gap is not a word to find.
  assert.doesNotMatch(registrySearchInput(byId.get("zinc-chloride"))?.body ?? "", /MISSING/);
  const rows = inventoryRows(reagents, []);
  assert.ok(rows.every((row) => row.path.startsWith(`${kindPath("reagent")}/`)), "an inventory row goes to the reagent's page");
});

test("no record stores what is computed: the protocols that use a reagent, or the amounts they use", async () => {
  const names = (await readdir(new URL("content/registry/reagent/", root))).filter((n) => n.endsWith(".md"));
  assert.equal(names.length, 16);
  for (const name of names) {
    const data = matter(await text(`content/registry/reagent/${name}`), {}).data;
    for (const field of ["protocols", "used_in", "stock", "final", "amount", "per"]) assert.equal(Object.hasOwn(data, field), false, `${name} stores ${field}`);
  }
});

test("the table lists each reagent's protocols, read from the protocols that name it, and every gap with its reason", () => {
  const protocols = [
    { path: "/research/protocols/a", title: "A", materials: [{ reagent: { id: "zinc-chloride" } }, { reagent: { id: "ethanol" } }, { reagent: { id: "ethanol" } }] },
    { path: "/research/protocols/b", title: "B", materials: [{ reagent: null }] },
    { path: "/research/protocols/c" },
  ];
  assert.deepEqual(reagentUses("zinc-chloride", protocols), [{ path: "/research/protocols/a", title: "A" }]);
  assert.equal(reagentUses("ethanol", protocols).length, 1, "a protocol that names it twice is listed once");
  const rows = reagentRows(reagents, protocols);
  assert.equal(REAGENTS.fields.find((f) => f.key === "protocols").value(rows.find((r) => r.id === "zinc-chloride")), "A");
  const md = reagentsMarkdown(rows, "https://example.com");
  for (const line of [
    "| Reagent | Supplier | Catalog number | Link | Protocols |",
    "| Zinc chloride (ZnCl2) |",
    "| GoTaq® Flexi DNA polymerase | Promega | M8296 | [product](https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296) |",
    "| PYCa | Prepared in lab |",
    "[A](https://example.com/research/protocols/a)",
    "Not found:",
    "- Zinc chloride, supplier: No record in the repo states who supplies the lab's zinc chloride.",
    "- PYCa, recipe: No procedure with the recipe profile exists yet for the lab's PYCa.",
  ]) assert.ok(md.includes(line), line);
});

test("a protocol's Reagents table is drawn from the registry: where each reagent comes from, beside the protocol's own amount, stock and final", async () => {
  const { compileDirectory } = await import("../scripts/lib/procedures.mjs");
  const compiled = await compileDirectory("content/procedures");
  const coi = compiled.find((c) => c.slug === "coi-primers")?.compiled;
  assert.ok(coi?.ok, JSON.stringify(coi?.errors));
  const gotaq = coi.record.materials.find((m) => m.name === "GoTaq Flexi DNA polymerase");
  assert.equal(gotaq.display, "GoTaq® Flexi DNA polymerase");
  assert.deepEqual(gotaq.reagent, {
    id: "gotaq-flexi-dna-polymerase",
    name: "GoTaq® Flexi DNA polymerase",
    status: "published",
    preparedInLab: false,
    supplier: "Promega",
    catalogNumber: "M8296",
    productUrl: "https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296",
    recipe: null,
  });
  assert.deepEqual(reagentSource(gotaq.reagent), { text: "Promega, M8296", href: gotaq.reagent.productUrl });
  assert.ok(coi.markdown.includes("source [Promega, M8296](https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296)"), "the twin carries the source");
  assert.ok(coi.record.materials.some((m) => m.reagent?.id === "neb-100-bp-dna-ladder"), "the ladder is a reagent of the protocol");
  assert.ok(!coi.record.equipment.some((e) => /ladder/i.test(e.name)), "and is no longer listed under equipment");
  const isolation = compiled.find((c) => c.slug === "phage-isolation")?.compiled;
  const pyca = isolation.record.materials.find((m) => m.name === "PYCa");
  assert.deepEqual(reagentSource(pyca.reagent), { text: "Prepared in the lab", href: null });
  assert.ok(isolation.markdown.includes("source Prepared in the lab"));
});

test("STORED ONCE: no protocol types a reagent's catalog number or product page, and every reagent a material names is one the registry holds", async () => {
  const typed = reagents.flatMap((r) => [r.fields.product_url, r.fields.catalog_number].filter((v) => typeof v === "string" && !v.startsWith("MISSING")));
  assert.ok(typed.length >= 6);
  const used = new Set();
  for (const name of (await readdir(new URL("content/procedures/", root))).filter((n) => n.endsWith(".md"))) {
    const raw = await text(`content/procedures/${name}`);
    for (const value of typed) assert.ok(!raw.includes(value), `${name} types "${value}"; it is stored once, in content/registry/reagent`);
    for (const material of matter(raw, {}).data.materials ?? []) {
      if (material.reagent === undefined) continue;
      assert.ok(byId.has(material.reagent), `${name}: ${material.reagent} is not in the registry`);
      used.add(material.reagent);
    }
  }
  assert.deepEqual([...byId.keys()].filter((id) => !used.has(id)), [], "a registry reagent no protocol uses");
});

test("the compile refuses what a protocol may not say about a reagent", async () => {
  const { compileProcedure } = await import("../app/kb/procedures/compile.mjs");
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
