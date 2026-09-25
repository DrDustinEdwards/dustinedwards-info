/**
 * The roving tabindex key map behind the editor toolbar, the layout radio group and the slash menu:
 * one tab stop per group, arrows move within it and wrap, Home and End jump to the ends.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { rovingTarget } from "../app/lib/admin/roving.mjs";

test("horizontal arrows move and wrap at both ends", () => {
  assert.equal(rovingTarget("ArrowRight", 0, 3), 1);
  assert.equal(rovingTarget("ArrowRight", 2, 3), 0);
  assert.equal(rovingTarget("ArrowLeft", 0, 3), 2);
  assert.equal(rovingTarget("ArrowLeft", 2, 3), 1);
});

test("Home and End jump to the first and last item", () => {
  assert.equal(rovingTarget("Home", 2, 5), 0);
  assert.equal(rovingTarget("End", 0, 5), 4);
});

test("the cross axis is not a movement key, so a vertical list leaves Left and Right alone", () => {
  assert.equal(rovingTarget("ArrowDown", 0, 3), null);
  assert.equal(rovingTarget("ArrowLeft", 1, 3, "vertical"), null);
  assert.equal(rovingTarget("ArrowDown", 1, 3, "vertical"), 2);
  assert.equal(rovingTarget("ArrowUp", 0, 3, "vertical"), 2);
});

test("other keys and an empty group move nothing", () => {
  assert.equal(rovingTarget("Enter", 0, 3), null);
  assert.equal(rovingTarget("a", 0, 3), null);
  assert.equal(rovingTarget("ArrowRight", 0, 0), null);
});
