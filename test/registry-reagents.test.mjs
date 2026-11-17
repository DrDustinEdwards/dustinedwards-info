import assert from "node:assert/strict";
import test from "node:test";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { compileRegistryItem, registrySetErrors } from "../app/kb/registry/compile.mjs";
import { REAGENT } from "../app/kb/registry/reagent.mjs";

/* The reagent kind (docs/REGISTRY.md): the substances the lab's protocols use, held as one table with a page for each item (A1); what a
 * reagent is bought from or how the lab prepares it; and the guard that holds a product's supplier, catalog number and page to the
 * registry, so each is stored once. */

await test("the kind refuses what is wrong, with the field named, and holds a reagent to bought or prepared", async () => {
  const kinds = { reagent: REAGENT };
  const host = { paper: async () => false, recipe: async (slug) => slug === "phage-buffer-recipe" };
  const compile = (lines) =>
    compileRegistryItem({
      slug: "reagent/x",
      raw: `---\n${lines.join("\n")}\n---\n`,
      host,
      pipeline: { findWideDashes },
      kinds,
    });
  assert.equal((await compile(["name: X", "supplier: A supplier", "catalog_number: C1"])).ok, true);
  assert.equal(
    (await compile(["name: X", "prepared_in_lab: true", "recipe: phage-buffer-recipe"])).ok,
    true,
    "a recipe that exists",
  );
  const bad = await compile([
    "name: X",
    "product_url: http://nope",
    "abbreviation: 12",
    "prepared_in_lab: false",
    "recipe: no-such-recipe",
  ]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of ["product_url", "abbreviation", "prepared_in_lab", "recipe"])
    assert.ok(message.includes(field), field);
  const item = (id, fields) => ({
    kind: "reagent",
    id,
    name: id,
    status: "published",
    fields: {
      abbreviation: null,
      contents: null,
      product_url: null,
      prepared_in_lab: null,
      recipe: null,
      supplier: null,
      catalog_number: null,
      ...fields,
    },
  });
  const set = (...items) => registrySetErrors(items, kinds).join("\n");
  assert.match(set(item("a", {})), /reagent\/a is bought, so it states its supplier/);
  assert.match(
    set(item("a", { supplier: "S", catalog_number: "C", recipe: "x" })),
    /not prepared in the lab, so it has no recipe/,
  );
  assert.match(
    set(item("a", { prepared_in_lab: true })),
    /prepared in the lab, so it states its recipe/,
  );
  assert.match(
    set(item("a", { prepared_in_lab: true, recipe: "MISSING: not yet", supplier: "S" })),
    /prepared in the lab, so it has no supplier/,
  );
  assert.equal(
    set(
      item("a", { prepared_in_lab: true, recipe: "MISSING: not yet" }),
      item("b", { supplier: "MISSING: why", catalog_number: "MISSING: why" }),
    ),
    "",
  );
});
