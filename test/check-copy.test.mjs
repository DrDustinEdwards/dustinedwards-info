/* The admin Overview names each health check in words (app/lib/admin/check-copy.mjs). A check the health run
 * makes with no words showed its code name, "registry-drift", in the checks table (Dustin's review,
 * 2026-10-11), so every check the run makes must have its words. */

import test from "node:test";
import assert from "node:assert/strict";

import { humanCheck } from "../app/lib/admin/check-copy.mjs";

await test("a check with no words yet is still shown as words, never its code name", () => {
  assert.equal(humanCheck({ name: "some-new-drift", ok: true, detail: "x" }).name, "Some new drift");
});
