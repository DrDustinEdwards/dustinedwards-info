import test from "node:test";
import assert from "node:assert/strict";

import { parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import {
  LIBRARY,
  keyFact,
  libraryCsv,
  libraryItems,
  libraryMarkdown,
  libraryOverview,
  libraryTabs,
  methodHref,
  overviewMarkdown,
  overviewSentence,
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

test("the overview is counted from the rows: a method with a protocol gets a tile, and the workflow counts each stage", () => {
  const o = libraryOverview(libraryItems(RECORDS));
  assert.deepEqual([o.total, o.methods, o.organisms, o.updated], [3, 3, 2, "2026-09-30"]);
  assert.deepEqual(o.tiles.map((t) => [t.id, t.count]), [["pcr", 2], ["plating", 1], ["culture", 1]]);
  const stage = Object.fromEntries(o.stages.map((s) => [s.id, s]));
  assert.equal(stage.isolate.count, 1);
  assert.equal(stage.isolate.href, "/research/protocols?method=plating&method=culture");
  assert.equal(stage.extract.href, null, "a stage with no protocol is drawn without a link");
  assert.equal(stage.sequence.count, 0);
});

test("a tile and a stage link to the address the facet itself would produce", () => {
  assert.equal(methodHref(["pcr"]), "/research/protocols?method=pcr");
  const hit = queryCatalog(LIBRARY, libraryItems(RECORDS), parseCatalogParams(LIBRARY, "method=plating&method=culture"));
  assert.deepEqual(hit.rows.map((r) => r.slug), ["isolation"]);
});

test("the overview sentence and the twin say what the page shows, with the singular where there is one", () => {
  const o = libraryOverview(libraryItems([record({ slug: "a", methods: ["pcr"], organisms: ["avian"] })]));
  assert.equal(overviewSentence(o), "1 protocol across 1 method, 1 organism, newest updated 2026-09-30.");
  const md = overviewMarkdown(o, "https://example.test");
  assert.match(md, /^## In the library\n\n1 protocol across 1 method/);
  assert.match(md, /- Extract DNA\n/);
  assert.match(md, /- \[PCR\]\(https:\/\/example\.test\/research\/protocols\?method=pcr\): 1 protocol/);
});

test("the tabs are All and each kind of work, counted from the rows; the current one is the method filter in the address", () => {
  const items = libraryItems(RECORDS);
  const tabs = libraryTabs(items, []);
  assert.deepEqual(tabs.map((t) => [t.id, t.count, t.current]), [["all", 3, true], ["phage", 1, false], ["pcr", 2, false]]);
  assert.equal(tabs[0].href, "/research/protocols");
  assert.equal(tabs[2].href, "/research/protocols?method=pcr");
  assert.deepEqual(libraryTabs(items, ["pcr"]).map((t) => t.current), [false, false, true]);
  const phage = libraryTabs(items, ["plating", "culture", "extraction", "sequencing", "annotation"]);
  assert.deepEqual(phage.map((t) => t.current), [false, true, false], "the phage tab is its methods exactly");
  assert.deepEqual(libraryTabs(items, ["pcr", "plating"]).map((t) => t.current), [false, false, false], "a mixed filter is no tab's");
});
