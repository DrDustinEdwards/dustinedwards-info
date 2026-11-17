/* The machine layer for the pages added the week of 2026-09-22 (the software pages, the lab calculators
 * and the CV): each is in the search index, has its markdown twin and its llms.txt line, and names its own
 * social card. The page list is every rendered page under their roots, so a calculator added under
 * /research/tools is held to all four with no edit here.
 *
 * The index is D1's search_docs, which sync:content rebuilds outright from every record the content
 * artifact carries (buildSearchSql), and build:content puts these records in that artifact through
 * contentPageSearchInputs. So the records are asserted here, where they are derived, and never by a row
 * written into the database. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  contentPageCardInput,
  contentPageCardPath,
  contentPageSearchInputs,
} from "../app/lib/content-pages.mjs";
import { ogImageKey } from "../app/lib/content/og-card-text.mjs";
import { recordsForPages } from "../app/lib/search/records.mjs";
import { renderContentPages } from "../scripts/build-content.mjs";
import { buildDictionary } from "../scripts/lib/dictionary.mjs";

const pages = await renderContentPages();
/** The entries that lead the named software pages, read from content/dictionary as the build reads them. */
const { entryFor } = await buildDictionary();
/** The pages this week added, and any page added under their roots later. */
const ROOTS = ["/software", "/research/tools", "/cv"];
const added = pages.filter((page) =>
  ROOTS.some((root) => page.path === root || page.path.startsWith(`${root}/`)),
);
const records = recordsForPages(contentPageSearchInputs(pages, entryFor));

await test("each page is in the search index: a page record with text, and a record per section heading", () => {
  for (const page of added) {
    const own = records.find((record) => record.url === page.path);
    assert.ok(own, `${page.path} has no search record`);
    assert.equal(own.type, "page", page.path);
    assert.equal(own.status, "published", page.path);
    assert.equal(own.title, page.title, page.path);
    assert.ok(
      own.body.includes(page.description),
      `${page.path}: the record's text leaves out its description`,
    );
    const sections = records.filter((record) => record.docUrl === page.path && record.anchor);
    const headings = page.toc.filter((heading) => heading.depth <= 3).length;
    assert.ok(
      headings === 0 || sections.length > 0,
      `${page.path} has ${headings} headings and no section records`,
    );
  }
});

await test("each page names its own card, keyed on what the card draws, and a retitle names a new one", () => {
  const keys = new Set();
  for (const page of added) {
    const card = contentPageCardPath(page);
    assert.equal(card, `/media/${ogImageKey(contentPageCardInput(page))}`, page.path);
    assert.match(
      card ?? "",
      /^\/media\/og\/dustin-edwards-page-[a-z0-9-]+-[0-9a-f]{8}\.png$/,
      page.path,
    );
    keys.add(card);
    assert.notEqual(
      contentPageCardPath({ ...page, seoTitle: `${page.seoTitle} (revised)` }),
      card,
      page.path,
    );
  }
  assert.equal(keys.size, added.length, "two pages share a card");
  assert.equal(
    contentPageCardPath({ path: "/research/phages", seoTitle: "t", description: "d" }),
    null,
  );
});
