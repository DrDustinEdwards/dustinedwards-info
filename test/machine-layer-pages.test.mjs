/* The machine layer for the pages under the carded roots (the software pages, the lab calculators and the
 * CV): each is in the search index, has its markdown twin and its llms.txt line, and names its own social
 * card. Every case derives its page list from CONTENT_PAGE_PATHS and CARDED_PAGE_ROOTS, so a calculator
 * added under /research/tools is held to all four with no edit here.
 *
 * The index is D1's search_docs, which sync:content rebuilds outright from every record the content
 * artifact carries (buildSearchSql), and build:content puts these records in that artifact through
 * contentPageSearchInputs. So the records are asserted here, where they are derived, and never by a row
 * written into the database (hard rule 18). */

import test from "node:test";
import assert from "node:assert/strict";

import {
  markdownTableFacts,
} from "../app/lib/content-pages.mjs";
import { renderContentPages } from "../scripts/build-content.mjs";

const pages = await renderContentPages();

test("the phage table's Dataset facts come from the table itself", () => {
  const phages = pages.find((page) => page.path === "/research/phages");
  assert.ok(phages);
  const facts = markdownTableFacts(phages.markdown);
  assert.deepEqual(facts?.variableMeasured, ["Phage", "Year", "Host", "County", "PhagesDB", "Paper"]);
  assert.equal(facts?.temporalCoverage, "2017/2025");
  // One row per phage: the page gives each its own ### entry.
  assert.equal(facts?.rows, [...phages.markdown.matchAll(/^### /gm)].length);
  assert.equal(markdownTableFacts("No table here.\n"), null);
});
