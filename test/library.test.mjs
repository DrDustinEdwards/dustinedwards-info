import test from "node:test";
import assert from "node:assert/strict";

import {
  libraryCsv,
  libraryItems,
  libraryMarkdown,
  workflowContext,
  libraryOverview,
  libraryRecords,
} from "../app/kb/procedures/library.mjs";

/* The protocol library's pure half (app/kb/procedures/library.mjs): what a row is made of, how the catalog counts
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
  record({
    slug: "coi",
    path: "/research/protocols/coi",
    title: "COI primers",
    methods: ["pcr"],
    targets: ["COI"],
    sections: [{ blocks: [{ type: "steps", steps: [1, 2, 3] }] }],
  }),
  record({
    slug: "gapdh",
    path: "/research/protocols/gapdh",
    title: "Avian GAPDH",
    methods: ["pcr"],
    organisms: ["avian"],
    targets: ["GAPDH"],
  }),
  record({
    slug: "isolation",
    path: "/research/protocols/isolation",
    title: "Phage isolation, a | b",
    methods: ["plating", "culture"],
    organisms: ["smegmatis"],
    // The words for a strain come from the lab registry, baked into the record when the protocol is compiled.
    organismNames: { smegmatis: "Mycobacterium smegmatis" },
    courses: ["phage-discovery"],
    time: { total: "2 days", handsOn: null },
  }),
  record({ slug: "cake", profile: "recipe", path: "/recipes/cake", title: "Cake" }),
];

await test("the downloads carry every fact with words for the ids and honor the filters", () => {
  const items = libraryItems(RECORDS);
  const rows = libraryRecords(items, "method=plating", "https://example.test");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].methods, ["Plating and titering", "Culture"]);
  assert.deepEqual(rows[0].courses, ["Phage Discovery Program"]);
  assert.equal(rows[0].url, "https://example.test/research/protocols/isolation");
  // The CSV's quoting and joins are site-runtime's (./csv), tested there; the columns are the rows' own.
  assert.ok(
    libraryCsv(libraryRecords(items, "", "https://example.test")).startsWith(
      "id,title,url,kind,methods",
    ),
  );
});

await test("the twin's table links each protocol by its address and escapes a pipe in a cell", () => {
  const md = libraryMarkdown(libraryItems(RECORDS), "https://example.test");
  assert.match(md, /^\| Protocol \| Method \|/);
  assert.match(md, /\[COI primers\]\(https:\/\/example\.test\/research\/protocols\/coi\)/);
  assert.match(md, /a \\\| b/);
  assert.equal(md.split("\n").length, 2 + 3, "a header, a rule and a row for each protocol");
});

await test("the overview is counted from the rows: a method with a protocol gets a tile, and the workflow counts each stage", () => {
  const o = libraryOverview(libraryItems(RECORDS));
  assert.deepEqual([o.total, o.methods, o.organisms, o.updated], [3, 3, 2, "2026-09-30"]);
  assert.deepEqual(
    o.tiles.map((t) => [t.id, t.count]),
    [
      ["pcr", 2],
      ["plating", 1],
      ["culture", 1],
    ],
  );
  const stage = Object.fromEntries(o.stages.map((s) => [s.id, s]));
  assert.equal(stage.isolate.count, 1);
  assert.equal(stage.isolate.href, "/research/protocols?method=plating&method=culture");
  assert.equal(stage.extract.href, null, "a stage with no protocol is drawn without a link");
  assert.equal(stage.sequence.count, 0);
});

await test("a protocol knows its neighbors in the phage workflow from the stages, not from anything typed on it", () => {
  const items = libraryItems([
    record({
      slug: "iso",
      path: "/research/protocols/iso",
      title: "Isolation",
      methods: ["plating", "culture"],
    }),
    record({
      slug: "ext",
      path: "/research/protocols/ext",
      title: "Extraction",
      methods: ["extraction"],
    }),
    record({ slug: "pcr", path: "/research/protocols/pcr", title: "Primers", methods: ["pcr"] }),
  ]);
  const iso = workflowContext(items, "/research/protocols/iso");
  assert.equal(iso.stage, "Isolate and purify");
  assert.deepEqual(iso.before, []);
  assert.deepEqual(
    iso.after,
    [{ title: "Extraction", href: "/research/protocols/ext" }],
    "the nearest later stage that has a protocol",
  );
  assert.deepEqual(
    iso.tools.map((t) => t.href),
    [
      "/research/tools/titer",
      "/research/tools/dilution",
      "/research/tools/webbed-plate",
      "/research/tools/lysate-volume",
    ],
  );
  const ext = workflowContext(items, "/research/protocols/ext");
  assert.deepEqual(ext.before, [{ title: "Isolation", href: "/research/protocols/iso" }]);
  assert.deepEqual(ext.after, [], "nothing later has a protocol");
  assert.deepEqual(ext.tools, []);
  assert.equal(
    workflowContext(items, "/research/protocols/pcr"),
    null,
    "a primer set is outside the workflow",
  );
  assert.equal(workflowContext(items, "/research/protocols/nope"), null);
});
