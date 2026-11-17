import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EQUIPMENT_CATALOG,
  equipmentMarkdown,
  equipmentRows,
  equipmentUses,
} from "../app/kb/registry/catalog.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The equipment kind (docs/REGISTRY.md): the instruments and labware the protocols list, held as one table with a page for each item (A1),
 * who makes each (a gap until a record says), a centrifuge's rotor (a gap until Dustin names it), and the protocols that use each. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const items = built.items.filter((item) => item.kind === "equipment");

await test("the table lists each item's protocols, read from the protocols that name it, and every gap with its reason", () => {
  const protocols = [
    {
      path: "/research/protocols/a",
      title: "A",
      equipment: [
        { name: "55 °C water bath", item: { id: "water-bath" } },
        { name: "gel", item: null },
      ],
    },
    { path: "/research/protocols/b", title: "B", equipment: [{ name: "plain", item: null }] },
    { path: "/research/protocols/c" },
  ];
  assert.deepEqual(equipmentUses("water-bath", protocols), [
    { path: "/research/protocols/a", title: "A" },
  ]);
  const rows = equipmentRows(items, protocols);
  assert.equal(
    EQUIPMENT_CATALOG.fields
      .find((f) => f.key === "protocols")
      .value(rows.find((r) => r.id === "water-bath")),
    "A",
  );
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

await test("the compile refuses what a protocol may not say about equipment", async () => {
  const { compileProcedure } = await import("../app/kb/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const original = await text("content/procedures/phage-dna-extraction.md");
  const compile = (raw, registry = registryHost()) =>
    compileProcedure({ slug: "phage-dna-extraction", raw, pipeline, registry });
  assert.equal((await compile(original)).ok, true);
  const unknown = await compile(
    original.replace("equipment: heat-block", "equipment: no-such-item"),
  );
  assert.match(
    unknown.errors.join("\n"),
    /equipment\[heat block\]\.equipment names no equipment in the lab registry/,
  );
  const bad = await compile(original.replace("equipment: heat-block", "equipment: Not An Id"));
  assert.match(
    bad.errors.join("\n"),
    /\.equipment is the id of an equipment item in the lab registry/,
  );
  const none = await compileProcedure({ slug: "phage-dna-extraction", raw: original, pipeline });
  assert.equal(none.ok, false);
  assert.match(none.errors.join("\n"), /no lab registry/);
});
