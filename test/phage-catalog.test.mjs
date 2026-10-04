import test from "node:test";
import assert from "node:assert/strict";

import { PHAGES, hostLabel, phageListing } from "../app/lib/phages/catalog.mjs";
import { sortPhages } from "../app/lib/phages/compile.mjs";

/* The phage table's pure half (app/lib/phages/catalog.mjs): the order the page has always listed, the facets and counts,
 * and the search. What the served page must hold (every phage, the links, the twin) is checked by
 * app/lib/pages/invariants.mjs and test/worker/phages.test.ts. */

/** @param {string} name @param {number} year @param {Record<string, unknown>} over */
function phage(name, year, over = {}) {
  return { name, year, host: null, county: null, phagesdb: null, paper: null, formerly: null, note: null, ...over };
}

const PHAGES_SET = [
  phage("Rira", 2025, { host: "foliorum", county: "Milam County", phagesdb: "Rira" }),
  phage("Acorn15", 2017, { host: "smegmatis", county: "Hood County", phagesdb: "Acorn15" }),
  phage("Acorn2", 2017, { host: "smegmatis", county: "Hood County" }),
  phage("Leia", 2017, { host: "smegmatis", formerly: "Leia2" }),
  phage("Arlo", 2018, { host: "foliorum", county: "Parker County", phagesdb: "Arlo", paper: "10-1128-mra-01242-18" }),
  phage("Éclair", 2018, { host: "foliorum", county: "Erath County" }),
];

const names = (/** @type {{ rows: Array<{ name: string }> }} */ result) => result.rows.map((p) => p.name);

test("the default order is the page's own: year, then name folded and numeric, so the table reads as it always has", () => {
  assert.deepEqual(names(phageListing("", PHAGES_SET)), sortPhages(PHAGES_SET).map((p) => p.name), "the catalog's default order is sortPhages");
  const order = names(phageListing("", PHAGES_SET));
  const at = (/** @type {string} */ n) => order.indexOf(n);
  const shown = `order was ${JSON.stringify(order)}`;
  assert.ok(at("Acorn2") < at("Acorn15"), `numeric: Acorn2 before Acorn15; ${shown}`);
  assert.ok(at("Arlo") < at("Éclair"), `an accent folds into its letter: Arlo before Éclair; ${shown}`);
  assert.ok(Math.max(at("Acorn2"), at("Acorn15"), at("Leia")) < Math.min(at("Arlo"), at("Éclair")) && at("Rira") === 5, `year first; ${shown}`);
  assert.equal(phageListing("", PHAGES_SET).groups, null, "the phage table has no headings");
});

test("sorting by name or by year both ways; newest first is the whole order reversed", () => {
  assert.deepEqual(names(phageListing("sort=name", PHAGES_SET)), ["Acorn2", "Acorn15", "Arlo", "Éclair", "Leia", "Rira"]);
  assert.deepEqual(names(phageListing("sort=-year", PHAGES_SET)), ["Rira", "Éclair", "Arlo", "Leia", "Acorn15", "Acorn2"]);
});

test("host and county facets count what choosing them would give; the host reads without markdown emphasis", () => {
  const result = phageListing("", PHAGES_SET);
  const host = result.facets.find((f) => f.key === "host");
  assert.deepEqual(host.options.map((o) => [o.label, o.count]), [["Microbacterium foliorum", 3], ["Mycobacterium smegmatis mc²155", 3]]);
  assert.equal(hostLabel("smegmatis"), "Mycobacterium smegmatis mc²155");
  assert.deepEqual(names(phageListing("host=foliorum", PHAGES_SET)), ["Arlo", "Éclair", "Rira"]);
  assert.deepEqual(names(phageListing("host=foliorum&county=Erath+County", PHAGES_SET)), ["Éclair"]);
});

test("search finds a name, a county, or the name a phage was formerly given, folded", () => {
  assert.deepEqual(names(phageListing("q=eclair", PHAGES_SET)), ["Éclair"]);
  assert.deepEqual(names(phageListing("q=hood", PHAGES_SET)).sort(), ["Acorn15", "Acorn2"]);
  assert.deepEqual(names(phageListing("q=leia2", PHAGES_SET)), ["Leia"]);
});

test("the genome-paper facet is a yes: published, or all", () => {
  assert.deepEqual(names(phageListing("paper=published", PHAGES_SET)), ["Arlo"]);
  const paper = phageListing("", PHAGES_SET).facets.find((f) => f.key === "paper");
  assert.deepEqual(paper.options.map((o) => [o.label, o.count]), [["Published", 1]]);
});

test("every field is declared once: the catalog's columns are the table the page has always had", () => {
  const columns = PHAGES.fields.filter((f) => f.column).map((f) => f.column.header);
  assert.deepEqual(columns, ["Phage", "Year", "Host", "County", "PhagesDB", "Paper"]);
});
