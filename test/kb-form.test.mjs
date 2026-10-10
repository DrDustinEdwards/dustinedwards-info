import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { fileToForm, formToFile, splitFile } from "../app/kb/form.mjs";
import { entryFields, gapReason, itemFields } from "../app/kb/form-fields.mjs";

/* The Knowledge Base form editor's pure half (app/kb/form.mjs): a file read into the form and written back unchanged,
 * a changed field written alone, steps renumbered in their new order, and the fields each profile is edited with. */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).filter((f) => f.endsWith(".md")).map((f) => `${dir}/${f}`);

test("every procedure and every registry item round-trips through the form byte for byte, through JSON as a browser sends it", () => {
  const registry = readdirSync(new URL("../content/registry", import.meta.url)).flatMap((kind) => files(`content/registry/${kind}`));
  for (const path of [...files("content/procedures"), ...registry]) {
    const raw = read(path);
    const model = fileToForm(raw, { body: path.startsWith("content/procedures") });
    assert.equal(formToFile(raw, JSON.parse(JSON.stringify(model))), raw, path);
  }
});

test("a changed field is written alone; every other line keeps its text", () => {
  const raw = read("content/procedures/coi-primers.md");
  const model = fileToForm(raw);
  model.data.status = "in-use";
  model.data.biosafety_level = "BSL-1";
  model.data.updated = "2026-10-10";
  const out = formToFile(raw, model);
  const before = raw.split("\n");
  const after = out.split("\n");
  assert.equal(after.length, before.length);
  const changed = after.flatMap((line, i) => (line === before[i] ? [] : [line]));
  assert.deepEqual(changed, ["updated: 2026-10-10", "status: in-use", "biosafety_level: BSL-1"]);
});

test("a field the form removes is left out, and a new one goes after the rest", () => {
  const raw = read("content/registry/equipment/nanodrop.md");
  const model = fileToForm(raw, { body: false });
  model.data.manufacturer = "Thermo Fisher Scientific";
  model.data.draft = true;
  assert.equal(formToFile(raw, model), '---\nname: "NanoDrop"\nmanufacturer: Thermo Fisher Scientific\ndraft: true\n---\n');
  delete model.data.draft;
  model.data.manufacturer = undefined;
  assert.equal(splitFile(formToFile(raw, model)).fields.map((f) => f.key).join(","), "name");
});

test("steps moved in the form are renumbered from where their list starts, and their notes move with them", () => {
  const raw = read("content/procedures/phage-dna-extraction.md");
  const model = fileToForm(raw);
  const partB = model.body?.sections.find((s) => s.heading.startsWith("Part B"));
  const list = partB?.blocks.find((b) => b.type === "steps");
  assert.ok(list && list.type === "steps");
  assert.equal(list.start, 7);
  list.steps.reverse();
  const out = formToFile(raw, model);
  assert.match(out, /\n7\. Spin at 12,000 rpm/);
  assert.match(out, /\n8\. Add @potassium acetate/);
  // The potassium acetate step keeps its CRITICAL note, under its new number.
  assert.match(out, /8\. Add @potassium acetate[^\n]*\n(?: {3}[^\n]*\n)* {3}> CRITICAL: Mix until the precipitate/);
});

test("a protocol is edited with its closed lists, and a field the form has no input for is edited as YAML", () => {
  const model = fileToForm(read("content/procedures/coi-primers.md"));
  const fields = entryFields("protocol", model.data, [{ value: "smegmatis", label: "M. smegmatis" }]);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  assert.equal(byKey.get("status")?.kind, "select");
  assert.deepEqual(byKey.get("status")?.options?.map((o) => o.value), ["in-use", "in-development", "retired"]);
  assert.deepEqual(byKey.get("biosafety_level")?.options?.map((o) => o.value), ["BSL-1", "BSL-2"]);
  assert.equal(byKey.get("updated")?.kind, "date");
  assert.ok(byKey.get("organism")?.options?.some((o) => o.value === "smegmatis"));
  assert.equal(byKey.get("cycling")?.kind, "yaml");
  assert.equal(gapReason(model.data.status), "No source in the repo states a status for this protocol.");
  assert.equal(gapReason("in-use"), null);
});

test("a registry item is its name, its draft flag and its kind's fields", () => {
  const fields = itemFields(["supplier", "catalog_number", "prepared_in_lab"], { prepared_in_lab: true });
  assert.deepEqual(fields.map((f) => [f.key, f.kind]), [["name", "text"], ["draft", "checkbox"], ["supplier", "text"], ["catalog_number", "text"], ["prepared_in_lab", "checkbox"]]);
});

test("the compile holds status to its closed list and forked_from to its shape, and the page reads both", async () => {
  const { compileProcedure } = await import("../app/kb/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const raw = read("content/procedures/coi-primers.md");
  const compile = (text) => compileProcedure({ slug: "coi-primers", raw: text, pipeline, registry: registryHost() });
  const set = (field, value) => raw.replace(new RegExp(`^${field}: .*$`, "m"), `${field}: ${value}`);

  const inUse = await compile(set("status", "in-use"));
  assert.ok(inUse.ok, JSON.stringify(inUse.errors));
  assert.equal(inUse.record.status, "In use");

  const bogus = await compile(set("status", "sometimes"));
  assert.ok(!bogus.ok);
  assert.ok(bogus.errors.some((e) => e.startsWith('status is "sometimes"')));

  const forked = await compile(raw.replace(/^title: /m, "forked_from: { slug: pan-avian-gapdh, version: \"2\" }\ntitle: "));
  assert.ok(forked.ok, JSON.stringify(forked.errors));
  assert.deepEqual(forked.record.forkedFrom, { slug: "pan-avian-gapdh", version: "2" });

  const self = await compile(raw.replace(/^title: /m, "forked_from: { slug: coi-primers }\ntitle: "));
  assert.ok(!self.ok && self.errors.includes("forked_from names this procedure itself"));
  const shape = await compile(raw.replace(/^title: /m, "forked_from: { slug: Not A Slug, by: me }\ntitle: "));
  assert.ok(!shape.ok && shape.errors.some((e) => e.startsWith("forked_from is { slug, version }")));
});
