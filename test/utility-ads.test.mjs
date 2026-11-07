/**
 * The vintage ads behind the utility pages (docs/UTILITY-ADS.md). Adding an ad is adding a folder, so this is the
 * gate on that folder: every ad.json must be well formed and name only symbols its art.svg has, or the
 * page would render a hole. Server-side choice is checked once, since a random pick that ignores `?ad=` breaks the gallery's links.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";

import { adProblems, chooseAd } from "../app/utility-ads/model.mjs";

const root = new URL("../app/utility-ads/", import.meta.url);
const folders = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/ad.json`, root)))
  .map((entry) => entry.name);

await test("there is at least one ad", () => assert.ok(folders.length > 0));

for (const folder of folders) {
  await test(`ad ${folder} fits the template`, () => {
    const ad = JSON.parse(readFileSync(new URL(`${folder}/ad.json`, root), "utf8"));
    const art = readFileSync(new URL(`${folder}/art.svg`, root), "utf8");
    assert.equal(ad.id, folder, "the folder is the ad's id");
    assert.deepEqual(adProblems(ad, art), []);
  });
}

await test("?ad= names an ad, anything else is random", () => {
  const ads = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(chooseAd(ads, "?ad=b")?.id, "b");
  assert.equal(chooseAd(ads, "?ad=nope", () => 0.99)?.id, "c");
  assert.equal(chooseAd(ads, "", () => 0)?.id, "a");
});
