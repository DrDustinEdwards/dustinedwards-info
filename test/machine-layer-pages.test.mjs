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
import { readFileSync } from "node:fs";

import {
  CONTENT_PAGE_PATHS,
  contentPageMarkdownBody,
  contentPageSearchInputs,
  markdownTableFacts,
} from "../app/lib/content-pages.mjs";
import { recordsForPages } from "../app/lib/search/records.mjs";
import { renderContentPages } from "../scripts/build-content.mjs";

const pages = await renderContentPages();
/** The pages this week added, and any page added under their roots later. */
const ROOTS = ["/software", "/research/tools", "/cv"];
const added = pages.filter((page) => ROOTS.some((root) => page.path === root || page.path.startsWith(`${root}/`)));
const records = recordsForPages(contentPageSearchInputs(pages));

test("the pages under test are the software pages, the calculators and the CV", () => {
  // Scope, so an empty list cannot pass every case below: the eight software pages, four tool pages, the CV.
  assert.ok(added.length >= 13, `only ${added.length} pages`);
  for (const root of ROOTS) assert.ok(added.some((page) => page.path === root), `${root} has no page`);
  assert.ok(added.every((page) => CONTENT_PAGE_PATHS.includes(/** @type {any} */ (page.path))));
});

test("each page is in the search index: a page record with text, and a record per section heading", () => {
  for (const page of added) {
    const own = records.find((record) => record.url === page.path);
    assert.ok(own, `${page.path} has no search record`);
    assert.equal(own.type, "page", page.path);
    assert.equal(own.status, "published", page.path);
    assert.equal(own.title, page.title, page.path);
    assert.ok(own.body.includes(page.description), `${page.path}: the record's text leaves out its description`);
    const sections = records.filter((record) => record.docUrl === page.path && record.anchor);
    const headings = page.toc.filter((heading) => heading.depth <= 3).length;
    assert.ok(headings === 0 || sections.length > 0, `${page.path} has ${headings} headings and no section records`);
  }
});

test("a term only a page says finds it: the CV, a calculator and a software page", () => {
  const find = (/** @type {string} */ term) =>
    new Set(records.filter((record) => record.body.toLowerCase().includes(term)).map((record) => record.docUrl));
  assert.ok(find("pfu/ml").has("/research/tools/titer"));
  assert.ok(find("observable plot").has("/software/abscissa"));
  assert.ok(find("tarleton").has("/cv"));
});

test("each page has its markdown twin, led by its title, and is listed in llms.txt", () => {
  const llms = readFileSync(new URL("../content/llms.txt", import.meta.url), "utf8");
  for (const page of added) {
    const twin = contentPageMarkdownBody(page);
    assert.ok(twin.startsWith(`# ${page.title}\n\n`), page.path);
    assert.ok(twin.length > page.title.length + 200, `${page.path}: a twin of ${twin.length} characters`);
    assert.match(llms, new RegExp(`^ {2}${page.path.replaceAll("/", "\\/")}$`, "m"), `${page.path} is not in llms.txt`);
  }
});

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
