import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compileProcedure } from "../app/kb/procedures/compile.mjs";
import { gramsPerCup, ingredientNames, ingredientSteps, miseEnPlace, readUnits, showQuantity, showTemperatures, stepIngredients } from "../app/kb/procedures/recipe-views.mjs";
import * as pipeline from "../app/lib/content/pipeline.mjs";
import { registryHost } from "../scripts/lib/registry.mjs";

/* A recipe's views (docs/KNOWLEDGE-BASE.md, step 9): ingredients both ways (R2), metric and imperial with weight only from a
 * stated density (R3, DECIDE 7), and the mise-en-place (R5), all computed from the compiled record. */

const fixture = readFileSync(new URL("fixtures/procedures/recipe-fixture.md", import.meta.url), "utf8");
const compile = async (raw = fixture) => compileProcedure({ slug: "recipe-fixture", raw, pipeline, registry: registryHost() });
const q = (amount, unit, extra = {}) => ({ amount: String(amount), unit, fixed: false, min: Number(amount), max: Number(amount), ...extra });

test("an amount converts between metric and imperial; spoons, unknown units and the recipe's own units stay as written", () => {
  assert.equal(readUnits("imperial"), "imperial");
  assert.equal(readUnits("kelvin"), null);
  assert.equal(showQuantity(q(250, "g"), 1, null), "250 g");
  assert.equal(showQuantity(q(250, "g"), 1, "imperial"), "8.75 oz");
  assert.equal(showQuantity(q(500, "g"), 1, "imperial"), "1.1 lb");
  assert.equal(showQuantity(q(2, "cups"), 1, "metric"), "473 ml");
  assert.equal(showQuantity(q(240, "ml"), 2, "imperial"), "2 cup");
  assert.equal(showQuantity(q(1, "tbsp"), 1, "metric"), "1 tbsp");
  assert.equal(showQuantity(q(2, "eggs"), 2, "metric"), "4 eggs");
  // A fixed amount is not scaled, in any units.
  assert.equal(showQuantity(q(1, "lb", { fixed: true }), 3, "metric"), "454 g");
  // A range keeps the unit of its low end.
  assert.equal(showQuantity({ amount: "80 to 100", unit: "ml", fixed: false, min: 80, max: 100 }, 1, "imperial"), "0.25 to 0.5 cup");
});

test("volume becomes weight only where the recipe states grams per cup", () => {
  assert.equal(showQuantity(q(2, "cup"), 1, "metric", 120), "240 g");
  assert.equal(showQuantity(q(2, "cup"), 1, "metric"), "473 ml");
  // Imperial keeps a volume a volume.
  assert.equal(showQuantity(q(2, "cup"), 1, "imperial", 120), "2 cup");
});

test("a temperature in a step reads in the other scale, to the nearest 5 degrees", () => {
  assert.equal(showTemperatures("Bake at 180 °C for 20 minutes.", "imperial"), "Bake at 355 °F for 20 minutes.");
  assert.equal(showTemperatures("Heat to 350 °F.", "metric"), "Heat to 175 °C.");
  assert.equal(showTemperatures("Proof at 25 to 30 °C.", "imperial"), "Proof at 75 to 85 °F.");
  assert.equal(showTemperatures("Bake at 180 °C.", null), "Bake at 180 °C.");
});

test("the fixture's ingredients say their steps, each step says its ingredients, and the mise-en-place lists each once", async () => {
  const compiled = await compile();
  assert.ok(compiled.ok, JSON.stringify(compiled.errors));
  const { record } = compiled;
  const uses = ingredientSteps(record);
  assert.deepEqual(uses.get("flour")?.map((u) => u.number), [1]);
  assert.deepEqual(uses.get("olive oil")?.map((u) => u.number), [5]);
  assert.match(uses.get("olive oil")?.[0]?.id ?? "", /^cook-\d+-step-5$/);
  const first = record.sections[0]?.blocks.find((b) => b.type === "steps");
  assert.ok(first && first.type === "steps");
  const step1 = first.steps[0];
  assert.ok(step1);
  assert.deepEqual(stepIngredients(step1, 2, "imperial", gramsPerCup(record), ingredientNames(record)), [
    { name: "plain flour", amount: "1.1 lb" },
    { name: "salt", amount: "1 tsp" },
    { name: "instant yeast", amount: "2 tsp" },
  ]);
  const mise = miseEnPlace(record, 1, null);
  assert.equal(mise.items.length, record.materials.length);
  assert.equal(mise.text.split("\n")[0], "- 250 g plain flour");
});

test("grams_per_cup is a recipe's own number above 0, and the record carries it", async () => {
  const stated = await compile(fixture.replace("  - name: flour\n    display: plain flour", "  - name: flour\n    display: plain flour\n    grams_per_cup: 120"));
  assert.ok(stated.ok, JSON.stringify(stated.errors));
  assert.equal(stated.record.materials.find((m) => m.name === "flour")?.gramsPerCup, 120);
  const bad = await compile(fixture.replace("  - name: flour\n    display: plain flour", "  - name: flour\n    display: plain flour\n    grams_per_cup: lots"));
  assert.ok(!bad.ok && bad.errors.includes("materials[flour].grams_per_cup is the grams in one US cup of it, a number above 0"), JSON.stringify(bad.errors));
});
