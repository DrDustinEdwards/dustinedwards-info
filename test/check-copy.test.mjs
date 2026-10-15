/* The admin Overview names each health check in words (app/lib/admin/check-copy.mjs). A check the health run
 * makes with no words showed its code name, "registry-drift", in the checks table (Dustin's review,
 * 2026-10-11), so every check the run makes must have its words. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { WORDED_CHECKS, humanCheck } from "../app/lib/admin/check-copy.mjs";

const source = readFileSync(new URL("../app/lib/health/checks.server.ts", import.meta.url), "utf8");
const RUN = [...source.matchAll(/guard\("([a-z0-9-]+)"/g)].map((m) => m[1]);

await test("the health run's checks are read off its source", () => {
  assert.ok(RUN.length >= 15, `only ${RUN.length} checks found: the pattern no longer matches checks.server.ts`);
});

await test("every check the health run makes has a plain-English name on the Overview", () => {
  const missing = RUN.filter((name) => !WORDED_CHECKS.includes(name));
  assert.deepEqual(missing, [], `no words for ${missing.join(", ")}`);
  for (const name of RUN) {
    const shown = humanCheck({ name, ok: true, detail: "" }).name;
    assert.doesNotMatch(shown, /-/, `${name} is shown as "${shown}"`);
  }
});

await test("the lab registry check reads as words, passing and failing", () => {
  assert.equal(humanCheck({ name: "registry-drift", ok: true, detail: "" }).name, "Lab registry on the site");
  const failing = humanCheck({ name: "registry-drift", ok: false, detail: "", counts: { expected: 41, present: 39 } });
  assert.match(failing.finding, /^2 of the 41 lab registry items/);
});

await test("a check with no words yet is still shown as words, never its code name", () => {
  assert.equal(humanCheck({ name: "some-new-drift", ok: true, detail: "x" }).name, "Some new drift");
});
