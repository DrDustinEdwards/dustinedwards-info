import test from "node:test";
import assert from "node:assert/strict";

import { phageListing } from "../app/lib/phages/catalog.mjs";
import { sortPhages } from "../app/lib/phages/compile.mjs";

/* The phage table's pure half (app/lib/phages/catalog.mjs): the order the page has always listed, the facets and counts,
 * and the search. What the served page must hold (every phage, the links, the twin) is checked by
 * app/lib/pages/invariants.mjs and test/worker/phages.test.ts. */

/** @param {string} name @param {number} year @param {Record<string, unknown>} over */
function phage(name, year, over = {}) {
  return {
    name,
    year,
    host: null,
    county: null,
    phagesdb: null,
    paper: null,
    formerly: null,
    note: null,
    ...over,
  };
}

const PHAGES_SET = [
  phage("Rira", 2025, { host: "foliorum", county: "Milam County", phagesdb: "Rira" }),
  phage("Acorn15", 2017, { host: "smegmatis", county: "Hood County", phagesdb: "Acorn15" }),
  phage("Acorn2", 2017, { host: "smegmatis", county: "Hood County" }),
  phage("Leia", 2017, { host: "smegmatis", formerly: "Leia2" }),
  phage("Arlo", 2018, {
    host: "foliorum",
    county: "Parker County",
    phagesdb: "Arlo",
    paper: "10-1128-mra-01242-18",
  }),
  phage("Éclair", 2018, { host: "foliorum", county: "Erath County" }),
];

const names = (/** @type {{ rows: Array<{ name: string }> }} */ result) =>
  result.rows.map((p) => p.name);

await test("the default order is the page's own: year, then name folded and numeric, so the table reads as it always has", () => {
  const order = names(phageListing("", PHAGES_SET));
  assert.deepEqual(
    order,
    sortPhages(PHAGES_SET).map((p) => p.name),
    "the catalog's default order is sortPhages",
  );
  const at = (/** @type {string} */ n) => order.indexOf(n);
  assert.ok(at("Acorn2") < at("Acorn15"), "numeric: Acorn2 before Acorn15");
  assert.ok(at("Arlo") < at("Éclair"), "an accent folds into its letter: Arlo before Éclair");
  assert.ok(
    Math.max(at("Acorn2"), at("Acorn15"), at("Leia")) < Math.min(at("Arlo"), at("Éclair")) &&
      at("Rira") === 5,
    "year first",
  );
});

await test("search finds a name, a county, or the name a phage was formerly given, folded", () => {
  assert.deepEqual(names(phageListing("q=eclair", PHAGES_SET)), ["Éclair"]);
  assert.deepEqual(names(phageListing("q=hood", PHAGES_SET)).sort(), ["Acorn15", "Acorn2"]);
  assert.deepEqual(names(phageListing("q=leia2", PHAGES_SET)), ["Leia"]);
});
