import assert from "node:assert/strict";
import test from "node:test";

import { keyResources, keyResourcesMarkdown } from "../app/kb/procedures/key-resources.mjs";

/* A protocol's Key Resources Table (app/kb/procedures/key-resources.mjs, docs/KNOWLEDGE-BASE.md step 6): computed from the
 * record the compile bakes from the lab registry, grouped as STAR Methods groups it, and printed the same in the twin. */

const compiledProtocols = async () => {
  const { compileDirectory } = await import("../scripts/lib/procedures.mjs");
  return new Map((await compileDirectory("content/procedures")).map((c) => [c.slug, c.compiled]));
};

test("a PCR protocol lists its reagents and its primers, each with the source and identifier the registry states", async () => {
  const coi = (await compiledProtocols()).get("coi-primers");
  assert.ok(coi?.ok, JSON.stringify(coi?.errors));
  const groups = keyResources(coi.record);
  const byId = new Map(groups.map((g) => [g.id, g]));

  const gotaq = byId.get("chemicals")?.rows.find((r) => r.resource === "GoTaq® Flexi DNA polymerase");
  assert.deepEqual(gotaq, { resource: "GoTaq® Flexi DNA polymerase", href: null, source: "Promega", identifier: "Cat# M8296" });

  const lco = byId.get("oligonucleotides")?.rows.find((r) => r.resource === "LCO1490");
  assert.deepEqual(lco, {
    resource: "LCO1490",
    sequence: "5′-GGTCAACAAATCATAAAGATATTGG-3′",
    href: "/research/lab/primers/lco1490",
    source: "Folmer et al. 1994, Molecular Marine Biology and Biotechnology 3(5):294-299",
    identifier: "N/A",
  });

  // The groups come in STAR's order, and a group with nothing in it is left out.
  const order = ["strains", "chemicals", "oligonucleotides", "other"];
  assert.deepEqual(groups.map((g) => g.id), order.filter((id) => byId.has(id)));
  assert.ok(groups.every((g) => g.rows.length > 0));

  // The twin carries the same table.
  assert.ok(coi.markdown.includes("## Key resources"), "the twin has the table");
  assert.ok(coi.markdown.includes("| GoTaq® Flexi DNA polymerase | Promega | Cat# M8296 |"), "the twin row matches");
  assert.ok(
    coi.markdown.includes("| [LCO1490](/research/lab/primers/lco1490): `5′-GGTCAACAAATCATAAAGATATTGG-3′` | Folmer et al. 1994"),
    "a primer's row carries its sequence",
  );
});

test("a reagent named by two materials is listed once, a lab-prepared reagent has no catalog number, and a gap reads Not recorded", async () => {
  const record = {
    profile: "protocol",
    hostStrains: [{ id: "smegmatis", name: "Mycobacterium smegmatis mc²155", path: "/research/lab/strains/smegmatis", collection: "ATCC", collectionNumber: "700084" }],
    materials: [
      { reagent: { id: "pyca", name: "PYCa", preparedInLab: true, supplier: null, catalogNumber: null } },
      { reagent: { id: "pyca", name: "PYCa", preparedInLab: true, supplier: null, catalogNumber: null } },
      { reagent: { id: "ethanol", name: "Ethanol", preparedInLab: false, supplier: null, catalogNumber: null } },
      { reagent: null },
    ],
    primers: [{ id: "p", name: "P1", sequence: null, publishedIn: null }],
    equipment: [{ name: "a heat block", item: { name: "Heat block", manufacturer: null } }, { name: "ice", item: null }],
  };
  const groups = keyResources(/** @type {any} */ (record));
  assert.deepEqual(groups, [
    { id: "strains", heading: "Bacterial and virus strains", rows: [{ resource: "Mycobacterium smegmatis mc²155", href: "/research/lab/strains/smegmatis", source: "ATCC", identifier: "ATCC 700084" }] },
    {
      id: "chemicals",
      heading: "Chemicals, peptides, and recombinant proteins",
      rows: [
        { resource: "PYCa", href: null, source: "Prepared in the lab", identifier: "N/A" },
        { resource: "Ethanol", href: null, source: "Not recorded", identifier: "Not recorded" },
      ],
    },
    { id: "oligonucleotides", heading: "Oligonucleotides", rows: [{ resource: "P1", href: "/research/lab/primers/p", source: "Not recorded", identifier: "N/A" }] },
    { id: "other", heading: "Other", rows: [{ resource: "Heat block", href: null, source: "Not recorded", identifier: "N/A" }] },
  ]);
});

test("a recipe or a computational procedure has no table, and an empty table prints nothing", () => {
  assert.deepEqual(keyResources(/** @type {any} */ ({ profile: "recipe" })), []);
  assert.deepEqual(keyResources(/** @type {any} */ ({ profile: "computational" })), []);
  assert.deepEqual(keyResourcesMarkdown([]), []);
});

test("a pipe in a citation cannot split a twin row", () => {
  const lines = keyResourcesMarkdown([{ id: "other", heading: "Other", rows: [{ resource: "A | B", href: null, source: "S", identifier: "N/A" }] }]);
  assert.ok(lines.includes("| A \\| B | S | N/A |"));
});

test("a protocol's host strains are listed with their collection and number, as the registry states them", async () => {
  const isolation = (await compiledProtocols()).get("phage-isolation");
  assert.ok(isolation?.ok, JSON.stringify(isolation?.errors));
  const strains = keyResources(isolation.record).find((g) => g.id === "strains");
  assert.deepEqual(strains?.rows.find((r) => r.href === "/research/lab/strains/smegmatis"), {
    resource: "Mycobacterium smegmatis mc²155",
    href: "/research/lab/strains/smegmatis",
    source: "ATCC",
    identifier: "ATCC 700084",
  });
});
