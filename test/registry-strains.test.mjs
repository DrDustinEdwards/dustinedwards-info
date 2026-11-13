import assert from "node:assert/strict";
import test from "node:test";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { STRAINS, phageYearsText, strainRow } from "../app/kb/registry/catalog.mjs";
import { compileRegistryItem, registrySetErrors } from "../app/kb/registry/compile.mjs";
import { STRAIN, designationOf } from "../app/kb/registry/strain.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The strain kind (docs/REGISTRY.md): the two bacterial hosts of the lab's phage work, what is computed from them, and the
 * guard that holds a protocol's host strain to the registry's, so a collection number is stored once. */

const built = await buildRegistry();
const strains = built.items.filter((item) => item.kind === "strain");

await test("the kind refuses what is wrong, with the field named, and a name that says a different strain than its fields", async () => {
  const kinds = { strain: STRAIN };
  const host = { paper: async () => false };
  const compile = (lines) =>
    compileRegistryItem({
      slug: "strain/x",
      raw: `---\n${lines.join("\n")}\n---\n`,
      host,
      pipeline: { findWideDashes },
      kinds,
    });
  const good = [
    "name: Genus species ATCC 1",
    "organism: Genus species",
    "collection: ATCC",
    'collection_number: "1"',
    'biosafety_level: "MISSING: not set"',
  ];
  assert.equal((await compile(good)).ok, true);
  const bad = await compile([
    "name: X",
    "organism: ",
    "guide_url: http://nope",
    "biosafety_level: BSL-9",
  ]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of [
    "organism",
    "collection",
    "collection_number",
    "guide_url",
    "biosafety_level",
  ])
    assert.ok(message.includes(field), field);
  const renamed = registrySetErrors(
    [
      {
        kind: "strain",
        id: "x",
        name: "Genus other ATCC 1",
        status: "published",
        fields: { organism: "Genus species", collection: "ATCC", collection_number: "1" },
      },
    ],
    kinds,
  );
  assert.match(renamed.join("\n"), /the name is computed from them/);
  assert.equal(
    designationOf({ strain: "mc²155", collection: "ATCC", collection_number: "700084" }),
    "mc²155",
  );
  assert.equal(designationOf({ collection: "NRRL", collection_number: "B-24224" }), "NRRL B-24224");
  assert.equal(
    designationOf({ collection: "NRRL", collection_number: "MISSING: not stated" }),
    null,
  );
});

await test("the phages isolated on a strain are read from the phages table by the strain's id, and counted, never copied", () => {
  const phages = [
    { name: "Zeta", year: 2023, host: "foliorum" },
    { name: "Acorn15", year: 2017, host: "smegmatis" },
    { name: "Beta2", year: 2018, host: "foliorum" },
    { name: "Beta10", year: 2018, host: "foliorum" },
    { name: "Unknown", year: 2026, host: null },
  ];
  const foliorum = strainRow(
    strains.find((s) => s.id === "foliorum"),
    phages,
  );
  assert.deepEqual(
    foliorum.phages.map((p) => p.name),
    ["Beta2", "Beta10", "Zeta"],
    "oldest first, then by name in natural order",
  );
  assert.equal(foliorum.phages[0].path, "/research/phages#beta2");
  assert.equal(phageYearsText(foliorum), "2018 to 2023");
  const smegmatis = strainRow(
    strains.find((s) => s.id === "smegmatis"),
    phages,
  );
  assert.equal(phageYearsText(smegmatis), "2017");
  assert.equal(phageYearsText(strainRow(strains[0], [])), null);
  assert.equal(STRAINS.fields.find((f) => f.key === "phages").value(foliorum), 3);
});
