import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import matter from "gray-matter";

import { renderBody } from "../app/lib/content/pipeline.mjs";
import { contentPageFile } from "../app/lib/content-pages.mjs";
import {
  columnValues,
  countText,
  DEFAULT_SORT,
  filterRows,
  PHAGESDB_RECORDS,
  phagesDbUrl,
  sortRows,
} from "../app/lib/phage-table.mjs";

const markdown = readFileSync(
  new URL(`../content/pages/${contentPageFile("/research/phages")}`, import.meta.url),
  "utf8",
);

/** The page as the server sends it: the build's own renderer, no script anywhere. */
const html = await renderBody({
  file: "research-phages.md",
  body: matter(markdown).content,
  resolveImage: async () => {
    throw new Error("the phages page has no images");
  },
}).then((result) => result.html);

/** The first table in the served HTML, row by row, each cell's raw HTML. */
function servedRows() {
  const table = /<table>([\s\S]*?)<\/table>/.exec(html)?.[1] ?? "";
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
  return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...(row[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1] ?? ""),
  );
}

const text = (/** @type {string} */ cell) => cell.replace(/<[^>]+>/g, "").trim();
const hrefs = (/** @type {string} */ cell) => [...cell.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

test("the served table has every phage, in the record's order, with no script", () => {
  const rows = servedRows();
  const names = Object.keys(PHAGESDB_RECORDS);
  assert.equal(names.length, 80, "the page says it lists 80 phages");
  assert.deepEqual(
    rows.map((cells) => text(cells[0] ?? "")),
    names,
  );
  for (const cells of rows) assert.equal(cells.length, 6, `${text(cells[0] ?? "")} has all six columns`);
  const head = /<thead>([\s\S]*?)<\/thead>/.exec(html)?.[1] ?? "";
  assert.deepEqual(
    [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1] ?? "")),
    ["Phage", "Year", "Host", "County", "PhagesDB", "Paper"],
  );
});

test("the table links PhagesDB for exactly the phages with a verified record, at that record", () => {
  for (const cells of servedRows()) {
    const name = text(cells[0] ?? "");
    const record = PHAGESDB_RECORDS[/** @type {keyof typeof PHAGESDB_RECORDS} */ (name)];
    const links = hrefs(cells[4] ?? "");
    if (record) assert.deepEqual(links, [phagesDbUrl(record)], `${name} links its record`);
    else assert.deepEqual(links, [], `${name} has no PhagesDB record and no link`);
  }
});

test("no PhagesDB link anywhere on the page points outside the verified records", () => {
  const verified = new Set(
    Object.values(PHAGESDB_RECORDS)
      .filter((record) => record !== null)
      .map((record) => phagesDbUrl(record)),
  );
  const all = [...html.matchAll(/href="(https:\/\/phagesdb\.org[^"]*)"/g)].map((m) => m[1]);
  assert.ok(all.length > 0);
  assert.deepEqual(all.filter((href) => !verified.has(String(href))), []);
  // Each linked phage's own section links it too, so the one-by-one list agrees with the table.
  for (const [name, record] of Object.entries(PHAGESDB_RECORDS)) {
    const section = markdown.split(`\n### ${name}\n`)[1]?.split("\n### ")[0] ?? "";
    assert.ok(section, `${name} has its own section`);
    assert.equal(section.includes("phagesdb.org"), record !== null, `${name}'s section`);
  }
});

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
