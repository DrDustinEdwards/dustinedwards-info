import test from "node:test";
import assert from "node:assert/strict";

import { parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import {
  LIBRARY,
  keyFact,
  libraryCsv,
  libraryItems,
  libraryMarkdown,
  libraryRecords,
  stepCount,
} from "../app/lib/procedures/library.mjs";

/* The protocol library's pure half (app/lib/procedures/library.mjs): what a row is made of, how the catalog counts
 * and filters it, and what the downloads and the twin say. Records here are minimal; the real ones come from D1. */

/** @param {Record<string, unknown>} over */
function record(over) {
  return {
    slug: "x",
    profile: "protocol",
    path: "/research/protocols/x",
    title: "X",
    description: "A protocol.",
    methods: [],
    organisms: [],
    targets: [],
    courses: [],
    updated: "2026-09-30",
    version: null,
    time: { total: null, handsOn: null },
    sections: [],
    ...over,
  };
}

const RECORDS = [
  record({ slug: "coi", path: "/research/protocols/coi", title: "COI primers", methods: ["pcr"], targets: ["COI"], sections: [{ blocks: [{ type: "steps", steps: [1, 2, 3] }] }] }),
  record({ slug: "gapdh", path: "/research/protocols/gapdh", title: "Avian GAPDH", methods: ["pcr"], organisms: ["avian"], targets: ["GAPDH"] }),
  record({
    slug: "isolation",
    path: "/research/protocols/isolation",
    title: "Phage isolation, a | b",
    methods: ["plating", "culture"],
    organisms: ["smegmatis"],
    courses: ["phage-discovery"],
    time: { total: "2 days", handsOn: null },
  }),
  record({ slug: "cake", profile: "recipe", path: "/recipes/cake", title: "Cake" }),
];

test("the library lists protocols and computational methods, and no recipe", () => {
  const items = libraryItems(RECORDS);
  assert.deepEqual(items.map((i) => i.slug), ["coi", "gapdh", "isolation"]);
});

test("the key fact is the targets, else the total time, else nothing: it is never typed", () => {
  assert.equal(keyFact(record({ targets: ["COI", "GAPDH"] })), "COI, GAPDH");
  assert.equal(keyFact(record({ time: { total: "2 days" } })), "2 days");
  assert.equal(keyFact(record({})), "");
});

test("steps are counted over every method section", () => {
  assert.equal(stepCount(RECORDS[0]), 3);
  assert.equal(stepCount(RECORDS[1]), 0);
});

test("facets count what choosing would give, and filters combine: or inside a facet, and between facets", () => {
  const items = libraryItems(RECORDS);
  const all = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, ""));
  assert.equal(all.total, 3);
  const method = all.facets.find((f) => f.key === "method");
  assert.deepEqual(method?.options.map((o) => [o.value, o.count]).sort(), [["culture", 1], ["pcr", 2], ["plating", 1]]);
  const pcr = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, "method=pcr"));
  assert.equal(pcr.count, 2);
  const pcrAvian = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, "method=pcr&organism=avian"));
  assert.deepEqual(pcrAvian.rows.map((r) => r.slug), ["gapdh"]);
  const either = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, "method=plating&method=pcr"));
  assert.equal(either.count, 3);
});

test("search ranks by field weight: a title match comes before a description match", () => {
  const items = libraryItems([
    record({ slug: "a", title: "Gel", description: "A protocol that mentions plating once." }),
    record({ slug: "b", title: "Plating", description: "Plates." }),
  ]);
  const hit = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, "q=plating"));
  assert.deepEqual(hit.rows.map((r) => r.slug), ["b", "a"]);
});

test("the downloads carry every fact with words for the ids, honour the filters, and quote what needs it", () => {
  const items = libraryItems(RECORDS);
  const rows = libraryRecords(items, "method=plating", "https://example.test");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].methods, ["Plating and titering", "Culture"]);
  assert.deepEqual(rows[0].courses, ["Phage Discovery Program"]);
  assert.equal(rows[0].url, "https://example.test/research/protocols/isolation");
  const csv = libraryCsv(libraryRecords(items, "", "https://example.test"));
  const lines = csv.split("\r\n");
  assert.equal(lines.at(-1), "", "ends with a line break");
  assert.ok(lines[0].startsWith("id,title,url,kind,methods"));
  assert.match(csv, /"Phage isolation, a \| b"/, "a comma makes the cell quoted");
  assert.match(csv, /Plating and titering; Culture/, "a list is joined with a semicolon");
});

test("the twin's table links each protocol by its address and escapes a pipe in a cell", () => {
  const md = libraryMarkdown(libraryItems(RECORDS), "https://example.test");
  assert.match(md, /^\| Protocol \| Method \|/);
  assert.match(md, /\[COI primers\]\(https:\/\/example\.test\/research\/protocols\/coi\)/);
  assert.match(md, /a \\\| b/);
  assert.equal(md.split("\n").length, 2 + 3, "a header, a rule and a row for each protocol");
});
