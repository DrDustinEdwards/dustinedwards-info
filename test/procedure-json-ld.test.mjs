import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compileProcedure } from "../app/kb/procedures/compile.mjs";
import { procedureJsonLd, protocolParameters } from "../app/kb/procedures/json-ld.mjs";
import { lineageErrors } from "../app/kb/procedures/lineage.mjs";
import * as pipeline from "../app/lib/content/pipeline.mjs";
import { registryHost } from "../scripts/lib/registry.mjs";

/* A protocol's structured data on Bioschemas LabProtocol 0.9-DRAFT (docs/KNOWLEDGE-BASE.md, P4), with its conditions as
 * `parameter`, and a variant's lineage (P3): resolved, written as the page and twin write it, and checked against the
 * procedures in the repository. */

const person = {
  "@type": "Person",
  "@id": "https://example.com/#person",
  name: "D",
  url: "https://example.com",
};
const raw = readFileSync("content/procedures/phage-dna-extraction.md", "utf8");
const compiled = await compileProcedure({
  slug: "phage-dna-extraction",
  raw,
  pipeline,
  registry: registryHost(),
});
assert.ok(compiled.ok, compiled.ok ? "" : compiled.errors.join("; "));
const { record } = compiled;

await test("a protocol states LabProtocol 0.9-DRAFT and carries every condition its steps state, once each, as parameter", () => {
  const ld = /** @type {any} */ (procedureJsonLd(record, "https://example.com", person));
  assert.equal(ld["@type"], "LabProtocol");
  assert.deepEqual(ld["http://purl.org/dc/terms/conformsTo"], {
    "@id": "https://bioschemas.org/profiles/LabProtocol/0.9-DRAFT",
  });
  const params = protocolParameters(record);
  assert.deepEqual(ld.parameter, params);
  const temperature = (/** @type {number} */ v) =>
    params.find((p) => p.name === "Temperature" && p.value === v);
  assert.deepEqual(temperature(37), {
    "@type": "PropertyValue",
    name: "Temperature",
    value: 37,
    unitCode: "CEL",
    unitText: "°C",
  });
  assert.deepEqual(
    params.find((p) => p.minValue === 55),
    {
      "@type": "PropertyValue",
      name: "Temperature",
      minValue: 55,
      maxValue: 60,
      unitCode: "CEL",
      unitText: "°C",
    },
    "a range is a min and a max",
  );
  // A g-force a step states in its SPIN flag is a condition too.
  assert.deepEqual(
    params.find((p) => p.maxValue === 15000),
    {
      "@type": "PropertyValue",
      name: "Relative centrifugal force",
      minValue: 10000,
      maxValue: 15000,
      unitText: "x g",
    },
  );
  assert.deepEqual(
    params.find((p) => p.unitText === "rpm" && p.value === 12000),
    { "@type": "PropertyValue", name: "Rotor speed", value: 12000, unitText: "rpm" },
  );
  const keys = params.map((p) => JSON.stringify(p));
  assert.equal(new Set(keys).size, keys.length, "each condition once");
  // Only what the steps state, in their words or their SPIN flags: never the materials' or the notes'.
  const stepText = JSON.stringify(record.sections).replaceAll(",", "");
  for (const p of params)
    assert.ok(
      stepText.includes(String(p.value ?? p.minValue)),
      `${JSON.stringify(p)} is stated in a step`,
    );
});

await test("a variant names a procedure here, of its profile, at a version that procedure states", () => {
  const procedures = new Map([
    [
      "phage-isolation",
      { profile: "protocol", version: "2", history: [{ version: "2" }, { version: "1" }] },
    ],
    ["tomato-soup", { profile: "recipe", version: null, history: [] }],
  ]);
  const variant = (/** @type {any} */ forkedFrom) =>
    lineageErrors({ forkedFrom, profile: "protocol" }, procedures);
  assert.deepEqual(variant({ slug: "phage-isolation", version: "1" }), []);
  assert.deepEqual(variant({ slug: "phage-isolation", version: null }), []);
  assert.deepEqual(variant(null), []);
  assert.deepEqual(variant({ slug: "phage-isolation", version: "3" }), [
    "forked_from names version 3 of phage-isolation, which states 2, 1",
  ]);
  assert.deepEqual(variant({ slug: "no-such", version: null }), [
    "forked_from names no-such, which is not a procedure here",
  ]);
  assert.deepEqual(variant({ slug: "tomato-soup", version: null }), [
    "forked_from names tomato-soup, a recipe; a variant keeps its parent's profile (protocol)",
  ]);
});
