import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { ProcedureView } from "~/components/procedure";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { compileProcedure } from "~/kb/procedures/compile.mjs";
import type { ProcedureRecord } from "~/kb/procedures/render.mjs";
import { readScale } from "~/kb/procedures/route";

import fixture from "../fixtures/procedures/recipe-fixture.md?raw";

/* A recipe's page with its views (docs/KNOWLEDGE-BASE.md, step 9): each ingredient's steps linked, each step's ingredients,
 * metric and imperial at their own address, and the mise-en-place, all rendered on the server with no script. */

let record: ProcedureRecord;

beforeAll(async () => {
  const { renderBody, findWideDashes } = await loadPipeline();
  const compiled = await compileProcedure({ slug: "recipe-fixture", raw: fixture, pipeline: { renderBody, findWideDashes } });
  if (!compiled.ok) throw new Error(compiled.errors.join("; "));
  record = compiled.record;
  // The first compile loads the markdown pipeline, which takes a while in the Workers runtime.
}, 120_000);

const page = (search: string) => {
  const { count, factor, units } = readScale(record, new URL(`https://example.com/recipes/recipe-fixture${search}`));
  return renderToStaticMarkup(createElement(ProcedureView, { record, count, factor, units }));
};

describe("a recipe's views", () => {
  it("links each ingredient to the steps that use it, and lists each step's ingredients", () => {
    const html = page("");
    expect(html).toContain('<th scope="col">Used in steps</th>');
    expect(html).toMatch(/<li value="5" id="cook-\d+-step-5"/);
    expect(html).toMatch(/<a href="#cook-\d+-step-5">5<\/a>/);
    expect(html).toContain("Ingredients: </span>250 g plain flour, 1 tsp salt, 1 tsp instant yeast");
  });

  it("shows metric or imperial at its own address, scaled, from the same GET form as servings", () => {
    const html = page("?servings=8&units=imperial");
    expect(html).toContain('<select name="units">');
    expect(html).toContain('<option value="imperial" selected="">Imperial (US)</option>');
    expect(html).toContain("Ingredients: </span>1.1 lb plain flour, 1 tsp salt, 2 tsp instant yeast");
    // A protocol's page has no units: they are a recipe's.
    expect(readScale({ ...record, profile: "protocol" } as ProcedureRecord, new URL("https://example.com/x?units=imperial")).units).toBeNull();
  });

  it("lays out a mise-en-place checklist and a shopping list to copy, at the reader's servings and units", () => {
    const html = page("?units=imperial");
    expect(html).toContain('<h3 id="mise-en-place">Mise en place</h3>');
    expect(html).toContain('<input type="checkbox"/> 8.75 oz plain flour');
    expect(html).toContain("- 8.75 oz plain flour\n- 1 tsp salt");
  });
});
