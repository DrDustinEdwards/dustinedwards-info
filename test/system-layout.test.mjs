// The inside of every system on /systems: what a circle holds (scripts/lib/system-layout.mjs), drawn at build
// time, and how the route puts the drawings into Capsomer's map (app/lib/system-wiring.mjs). Fixtures use
// invented systems; the last test draws the committed model.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { layoutMap, systemMapHtml } from "capsomer/behaviour/system-map";

import { wireMapHtml, zoomInMapHtml } from "../app/lib/system-wiring.mjs";
import { loadSystemModel, mapData, summaryOf } from "../app/lib/systems.mjs";
import { faultsOf, insideLayers, layoutScene, sceneOf } from "../scripts/lib/system-layout.mjs";

const fixture = () =>
  loadSystemModel({
    version: 1,
    as_of: "2026-10-18",
    systems: [
      { id: "core", name: "Core", short: "Core", family: "system", ring: "core", private: false, description: "Runs it all." },
      { id: "kit", name: "Kit", short: "Kit", family: "plumbing", ring: "shared", private: false, description: "Shared parts." },
      { id: "app", name: "App", short: "App", family: "product", ring: "used", private: false, description: "What people use." },
      { id: "hidden", name: "Hidden", short: "Hidden", domain: "hidden.example.org", family: "product", ring: "used", private: true },
    ],
    containers: [
      { id: "core-worker", system: "core", name: "Worker", kind: "worker", technology: "Cloudflare Worker" },
      { id: "core-db", system: "core", name: "core-db", kind: "database", technology: "D1" },
      { id: "core-github", system: "core", name: "GitHub", kind: "external", technology: "GitHub" },
      { id: "app-worker", system: "app", name: "App Worker", kind: "worker", technology: "Cloudflare Worker" },
    ],
    relationships: [
      { id: "core-worker--reads--core-db", from: "core-worker", to: "core-db", kind: "reads" },
      { id: "core-worker--writes--core-github", from: "core-worker", to: "core-github", kind: "writes" },
      { id: "core--installs--kit", from: "core", to: "kit", kind: "installs" },
      { id: "core-worker--serves--app-worker", from: "core-worker", to: "app-worker", kind: "serves" },
      { id: "core--serves--app", from: "core", to: "app", kind: "serves" },
      { id: "core--coordinates--hidden", from: "core", to: "hidden", kind: "coordinates" },
    ],
    counts: { systems: 4, public: 3, private: 1, containers: 4, relationships: 6 },
  });

const ends = (/** @type {{ wires: Array<{ from: string, to: string }> }} */ scene) => scene.wires.map((w) => `${w.from} ${w.to}`).sort();

await test("a circle holds its parts, what it works with outside on the rim, and every system it connects to", () => {
  const scene = sceneOf(fixture(), "core");
  const roles = Object.fromEntries(scene.nodes.map((n) => [n.id, n.role]));
  assert.deepEqual(roles, { "core-worker": "part", "core-db": "part", "core-github": "outside", "system:kit": "system", "system:app": "system", "system:hidden": "system" });
  assert.equal(scene.nodes.find((n) => n.id === "system:hidden")?.private, true);
  // Each wire from the exact part that uses it; a line between systems as wholes from the circle, unless a part
  // of this system already wires to that system (app).
  assert.deepEqual(ends(scene), ["core system:hidden", "core system:kit", "core-worker core-db", "core-worker core-github", "core-worker system:app"]);
  const loose = scene.wires.filter((w) => w.loose).map((w) => w.to);
  assert.deepEqual(loose, ["system:hidden"], "a line that coordinates is loose");
});

await test("a system with no parts draws a circle with its name and summary, and its links on the rim", () => {
  const model = fixture();
  const layers = insideLayers(model, summaryOf, mapData(model));
  assert.deepEqual(Object.keys(layers).sort(), ["app", "core", "hidden", "kit"]);
  const hidden = layers.hidden ?? "";
  assert.doesNotMatch(hidden, /cap-system-map-box/, "a private system draws no part");
  assert.match(hidden, /class="systems-inside-name"[^>]*>Hidden</);
  assert.match(hidden, /class="systems-rim" data-goto="core"/);
  const kit = layers.kit ?? "";
  assert.doesNotMatch(kit, /cap-system-map-box/);
  assert.match(kit, /data-goto="core"/);
  // Every system's layer is Capsomer's inside layer, named for its system, hidden until shown.
  for (const [id, svg] of Object.entries(layers)) assert.match(svg, new RegExp(`^<svg class="cap-system-map-layer" data-layer="inside" data-system="${id}" viewBox="[^"]+" aria-hidden="true"`));
});

await test("the drawing places every box apart and no wire under a box, on a small system", () => {
  const model = fixture();
  const shell = layoutMap(mapData(model).systems).viewBox;
  const l = layoutScene(sceneOf(model, "core"), shell[2]);
  assert.deepEqual(faultsOf(l), []);
  for (const n of l.nodes.filter((n) => n.role === "part")) assert.ok(Math.hypot(Math.abs(n.x) + n.w / 2, Math.abs(n.y) + n.h / 2) <= l.r, `${n.id} is inside the circle`);
  for (const n of l.nodes.filter((n) => n.role !== "part")) assert.ok(Math.abs(n.y) - n.h / 2 >= 0 && Math.hypot(n.x, n.y) > l.r, `${n.id} is outside the circle`);
});

await test("the route sends the circles it is given and names the asset holding them all; a chosen system opens zoomed in", () => {
  const model = fixture();
  const layers = insideLayers(model, summaryOf, mapData(model));
  const capsomer = systemMapHtml(mapData(model), { id: "family", label: "Family" });
  const url = "/assets/system-insides-abc.json";
  const rest = wireMapHtml(capsomer, {}, "core", url);
  assert.doesNotMatch(rest, /data-layer="inside"/, "Capsomer's own inside layer is replaced by the ones given: none");
  assert.match(rest, /<figure class="cap-system-map" data-cap="system-map" data-insides="\/assets\/system-insides-abc.json"/);
  // The detail line and the views are sent shown (systems.css hides them where no script runs).
  assert.doesNotMatch(rest, /data-cap-part="(?:detail|views)"[^>]* hidden>/);

  const all = wireMapHtml(capsomer, layers, "core", url);
  const order = [...all.matchAll(/data-layer="inside" data-system="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(order[0], "core", "Capsomer's controller takes the first inside layer as the core's");
  assert.deepEqual([...order].sort(), ["app", "core", "hidden", "kit"]);

  const one = wireMapHtml(capsomer, { app: layers.app ?? "" }, "core", url);
  const zoomed = zoomInMapHtml(one, "app");
  assert.match(zoomed, /<figure class="cap-system-map" data-cap="system-map" data-entered data-zoom="app" data-insides=/);
  assert.equal(zoomed.match(/data-layer="inside"/g)?.length, 1);
  assert.match(zoomed, /data-layer="inside" data-system="app" data-shown/);
  assert.equal(zoomed.replace(' data-entered data-zoom="app"', "").replace(" data-shown", ""), one, "zooming in adds attributes only");
});

await test("the committed model's circles have no two boxes touching and no wire under a box", () => {
  const model = loadSystemModel(JSON.parse(readFileSync(new URL("../data/system-model.json", import.meta.url), "utf8")));
  const shell = layoutMap(mapData(model).systems).viewBox;
  const bad = model.systems.flatMap((s) =>
    faultsOf(layoutScene(sceneOf(model, s.id), shell[2]))
      .filter((f) => f.includes(" touches ") || f.includes(" runs under "))
      .map((f) => `${s.id}: ${f}`),
  );
  assert.deepEqual(bad, []);
});
