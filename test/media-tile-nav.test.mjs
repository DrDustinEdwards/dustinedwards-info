/**
 * The media grid's arrow keys, over boxes shaped like a rendered grid: the browser decides the
 * column count, so the rows here are made from geometry the way the page makes them.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { bands, nextTile } from "../app/lib/media/tile-nav.mjs";

/** A grid of `count` tiles, `cols` to a row, 100px square with a 10px gap. */
function grid(count, cols) {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    top: Math.floor(i / cols) * 110,
    left: (i % cols) * 110,
    width: 100,
  }));
}

const ids = (rows) => rows.map((b) => b.items.map((i) => i.id));

test("bands groups tiles into rows by top and orders each row by centre", () => {
  assert.deepEqual(ids(bands(grid(5, 2))), [["t0", "t1"], ["t2", "t3"], ["t4"]]);
});

test("bands treats tops within 6px as one row and orders rows top to bottom", () => {
  const rows = bands([
    { id: "low", top: 200, left: 0, width: 50 },
    { id: "b", top: 4, left: 100, width: 50 },
    { id: "a", top: 0, left: 0, width: 50 },
    // Measured against the first tile a row met, b at 4: 10 is 6px away, so c starts a row.
    { id: "c", top: 10, left: 200, width: 50 },
  ]);
  assert.deepEqual(ids(rows), [["a", "b"], ["c"], ["low"]]);
});

test("bands skips a tile with no width, which is not laid out", () => {
  const rows = bands([
    { id: "shown", top: 0, left: 0, width: 100 },
    { id: "hidden", top: 0, left: 110, width: 0 },
  ]);
  assert.deepEqual(ids(rows), [["shown"]]);
});

test("nextTile on an empty page stays put", () => {
  assert.equal(nextTile([], "", "right"), null);
  assert.equal(nextTile([], "t0", "down"), null);
});

test("nextTile with nothing active, or an active tile gone from the page, starts at the first", () => {
  const rows = bands(grid(4, 2));
  assert.equal(nextTile(rows, "", "down"), "t0");
  assert.equal(nextTile(rows, "gone", "left"), "t0");
});

test("nextTile moves left and right within a row", () => {
  const rows = bands(grid(6, 3));
  assert.equal(nextTile(rows, "t0", "right"), "t1");
  assert.equal(nextTile(rows, "t2", "left"), "t1");
});

test("nextTile wraps left and right across rows in reading order, and stops at the ends", () => {
  const rows = bands(grid(6, 3));
  assert.equal(nextTile(rows, "t2", "right"), "t3");
  assert.equal(nextTile(rows, "t3", "left"), "t2");
  assert.equal(nextTile(rows, "t0", "left"), null);
  assert.equal(nextTile(rows, "t5", "right"), null);
});

test("nextTile moves up and down to the nearest centre, and stops at the top and bottom", () => {
  const rows = bands(grid(5, 3));
  assert.equal(nextTile(rows, "t1", "down"), "t4");
  assert.equal(nextTile(rows, "t4", "up"), "t1");
  // The last row is short: from the right column, down lands on the nearest tile it has.
  assert.equal(nextTile(rows, "t2", "down"), "t4");
  assert.equal(nextTile(rows, "t0", "up"), null);
  assert.equal(nextTile(rows, "t3", "down"), null);
});
