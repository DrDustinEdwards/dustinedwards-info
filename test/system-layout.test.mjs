// The circles on /systems, as committed: Capsomer draws them (capsomer/system-map-circles, tested there), and
// data/system-layouts.json keeps the ones it found for the committed model.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { layoutMap } from "capsomer/behaviour/system-map";
import { faultsOf, layoutKey, sceneOf } from "capsomer/system-map-circles";

import { loadSystemModel, mapData } from "../app/lib/systems.mjs";
import { readSavedLayouts } from "../scripts/lib/system-insides-plugin.mjs";

await test("the saved circles are the committed model's, with no two boxes touching and no wire under a box", () => {
  // A saved circle whose key moved would make every build search for it: `npm run build:layouts` saves it again.
  const data = mapData(loadSystemModel(JSON.parse(readFileSync(new URL("../data/system-model.json", import.meta.url), "utf8"))));
  const saved = readSavedLayouts();
  const shell = layoutMap(data.systems).viewBox;
  const stale = data.systems.filter((s) => saved[s.id]?.key !== layoutKey(sceneOf(data, s.id), shell[2])).map((s) => s.id);
  assert.deepEqual(stale, [], "data/system-layouts.json is out of date: run `npm run build:layouts` and commit it");
  assert.deepEqual(Object.keys(saved).sort(), data.systems.map((s) => s.id).sort());
  const bad = data.systems.flatMap((s) =>
    faultsOf(saved[s.id].layout)
      .filter((f) => f.includes(" touches ") || f.includes(" runs under "))
      .map((f) => `${s.id}: ${f}`),
  );
  assert.deepEqual(bad, []);
});
