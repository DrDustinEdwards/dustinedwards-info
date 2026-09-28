import test from "node:test";
import assert from "node:assert/strict";

import { aimsAt, inTriangle } from "../app/lib/menu-aim.mjs";

// A header row at y 32 over a card whose top edge runs from x 100 to x 800 at y 64.
const card = { left: 100, right: 800, top: 64 };

test("inTriangle takes the inside and the edges, in either winding, and refuses the outside", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  const c = { x: 0, y: 10 };
  assert.equal(inTriangle({ x: 2, y: 2 }, a, b, c), true);
  assert.equal(inTriangle({ x: 2, y: 2 }, a, c, b), true);
  assert.equal(inTriangle({ x: 5, y: 0 }, a, b, c), true);
  assert.equal(inTriangle({ x: 8, y: 8 }, a, b, c), false);
  assert.equal(inTriangle({ x: -1, y: 2 }, a, b, c), false);
});

test("a move down and to the right toward the card aims at it", () => {
  assert.equal(aimsAt({ x: 150, y: 30 }, { x: 170, y: 34 }, card), true);
});

test("a move straight down toward the card aims at it", () => {
  assert.equal(aimsAt({ x: 300, y: 30 }, { x: 300, y: 40 }, card), true);
});

test("a level move along the header does not aim at the card", () => {
  assert.equal(aimsAt({ x: 150, y: 32 }, { x: 200, y: 32 }, card), false);
});

test("an upward move does not aim at the card", () => {
  assert.equal(aimsAt({ x: 150, y: 32 }, { x: 200, y: 28 }, card), false);
});

test("a move down but past the card's far corner does not aim at it", () => {
  // From x 750 at y 32, a step to x 800 at y 33 would reach the card's top line far right of x 800.
  assert.equal(aimsAt({ x: 750, y: 32 }, { x: 800, y: 33 }, card), false);
});

test("a pointer that has not moved does not aim at anything", () => {
  assert.equal(aimsAt({ x: 150, y: 30 }, { x: 150, y: 30 }, card), false);
});
