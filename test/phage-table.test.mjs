import test from "node:test";
import assert from "node:assert/strict";

import {
  columnValues,
  countText,
  DEFAULT_SORT,
  filterRows,
  sortRows,
} from "../app/lib/phage-table.mjs";

// What the served table must hold (every phage, six columns, PhagesDB links only at verified records) is
// checked on the page itself by app/lib/pages/invariants.mjs, which build:content and the page save both run;
// test/pages.test.mjs shows each rule firing.

/** @param {string} name @param {number | null} year @param {string} host @param {string} county @param {number} order */
const row = (name, year, host, county, order) => ({ name, year, host, county, order });

const ROWS = [
  row("Acorn15", 2017, "M. smegmatis mc²155", "Hood County", 0),
  row("Leia", 2017, "M. smegmatis mc²155", "", 1),
  row("Astrid", 2018, "", "", 2),
  row("Finny", 2018, "M. foliorum", "Comal County", 3),
  row("Rira", 2025, "M. foliorum", "Milam County", 4),
];

const names = (/** @type {{ name: string }[]} */ rows) => rows.map((r) => r.name);

test("sortRows orders by each column both ways, blank cells last and ties in page order", () => {
  assert.deepEqual(names(sortRows(ROWS, DEFAULT_SORT.key, DEFAULT_SORT.direction)), names(ROWS));
  assert.deepEqual(names(sortRows(ROWS, "name", "ascending")), ["Acorn15", "Astrid", "Finny", "Leia", "Rira"]);
  assert.deepEqual(names(sortRows(ROWS, "name", "descending")), ["Rira", "Leia", "Finny", "Astrid", "Acorn15"]);
  assert.deepEqual(names(sortRows(ROWS, "year", "descending")), ["Rira", "Astrid", "Finny", "Acorn15", "Leia"]);
  assert.deepEqual(names(sortRows(ROWS, "county", "ascending")), ["Finny", "Acorn15", "Rira", "Leia", "Astrid"]);
  assert.deepEqual(names(sortRows(ROWS, "county", "descending")), ["Rira", "Acorn15", "Finny", "Leia", "Astrid"]);
  assert.deepEqual(names(sortRows(ROWS, "host", "ascending")), ["Finny", "Rira", "Acorn15", "Leia", "Astrid"]);
  assert.deepEqual(names(ROWS), ["Acorn15", "Leia", "Astrid", "Finny", "Rira"], "the input is not mutated");
});

test("filterRows matches every word across the cells, folded, and the selects exactly", () => {
  assert.deepEqual(names(filterRows(ROWS, { q: "", host: "", county: "" })), names(ROWS));
  assert.deepEqual(names(filterRows(ROWS, { q: "ACORN", host: "", county: "" })), ["Acorn15"]);
  assert.deepEqual(names(filterRows(ROWS, { q: "2018", host: "", county: "" })), ["Astrid", "Finny"]);
  assert.deepEqual(names(filterRows(ROWS, { q: "foliorum milam", host: "", county: "" })), ["Rira"]);
  assert.deepEqual(names(filterRows(ROWS, { q: "", host: "M. foliorum", county: "" })), ["Finny", "Rira"]);
  assert.deepEqual(names(filterRows(ROWS, { q: "", host: "M. foliorum", county: "Comal County" })), ["Finny"]);
  assert.deepEqual(names(filterRows(ROWS, { q: "nothing", host: "", county: "" })), []);
});

test("columnValues lists each non-blank value once, and countText says the count", () => {
  assert.deepEqual(columnValues(ROWS, "host"), ["M. foliorum", "M. smegmatis mc²155"]);
  assert.deepEqual(columnValues(ROWS, "county"), ["Comal County", "Hood County", "Milam County"]);
  assert.equal(countText(80, 80), "Showing all 80 phages.");
  assert.equal(countText(12, 80), "Showing 12 of 80 phages.");
  assert.equal(countText(0, 80), "No phages match. 80 in all.");
});
