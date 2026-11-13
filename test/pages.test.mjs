import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findWideDashes, renderBody } from "../app/lib/content/pipeline.mjs";
import { compilePage } from "../app/lib/pages/compile.mjs";
import { idsIn, pageLinkErrors } from "../app/lib/pages/links.mjs";
import { buildPhages } from "../scripts/lib/phages.mjs";

/* The validation module every page write runs (app/lib/pages/compile.mjs): build:content, sync:content and
 * the page save. These cases show each rule firing, on the real page files with one line changed, so a rule
 * that stopped firing would fail here instead of letting an edit through. */

const pipeline = { renderBody, findWideDashes };
const dir = new URL("../content/pages/", import.meta.url);
const read = (/** @type {string} */ slug) => readFileSync(new URL(`${slug}.md`, dir), "utf8");
/** The phage page draws its table from the phage files (docs/PHAGES.md; test/phages.test.mjs holds those rules). */
const { phages } = await buildPhages();
const compile = (/** @type {string} */ slug, /** @type {string} */ raw) =>
  compilePage({ slug, raw, pipeline, phages });
/** Built from its code point, so this file carries no literal wide dash. */

/**
 * The errors a changed page raises: asserts it was refused, and returns every message.
 *
 * @param {string} slug
 * @param {(raw: string) => string} mutate
 */
async function refusal(slug, mutate) {
  const raw = read(slug);
  const changed = mutate(raw);
  assert.notEqual(changed, raw, "the mutation changed nothing, so it proves nothing");
  const result = await compile(slug, changed);
  assert.equal(result.ok, false, `${slug} was accepted after the change`);
  return result.ok ? "" : result.errors.join("\n");
}

await test("the calculator pages must still state what the calculator prints", async () => {
  assert.match(
    await refusal("research-tools-titer", (r) => r.replace("The titer is", "The titer might be")),
    /the page lacks the calculator's answer/,
  );
  assert.match(
    await refusal("research-tools", (r) =>
      r.replace("](/research/tools/moi)", "](/research/tools/nothing)"),
    ),
    /lacks a link to the calculator at \/research\/tools\/moi/,
  );
  assert.match(
    await refusal("teaching-virus-isolation-faq", (r) =>
      r.replace("= 1 x 10^-3 µl", "= 1.02 x 10^-3 µl"),
    ),
    /lysate-per-plate sum/,
  );
});

/** An address book that lists a procedure, one live post and one draft. */
const book = {
  procedurePaths: new Set(["/research/protocols/phage-dna-extraction"]),
  posts: new Map([
    ["/writing/live", true],
    ["/writing/hidden", false],
  ]),
  idsOf: (/** @type {string} */ path) =>
    path === "/research/phages" ? idsIn('<h3 id="Acorn15">Acorn15</h3>') : null,
};

await test("links: a link that provably goes nowhere is refused, and an address the module cannot list (a lab registry item) passes", () => {
  const errors = pageLinkErrors(
    {
      html: [
        '<a href="/research/nothing-here">a</a>',
        '<a href="/writing/hidden">b</a>',
        '<a href="/research/phages#Nope">c</a>',
        '<a href="/research/phages#Acorn15">fine anchor</a>',
        '<a href="/research/protocols/phage-dna-extraction.md">procedure twin</a>',
        '<a href="/writing/live">live post</a>',
        '<a href="/contact">unlisted namespace</a>',
        '<a href="/research/lab/strains/smegmatis">lab registry item</a>',
        '<a href="https://example.org/x">external</a>',
      ].join(""),
    },
    book,
  );
  assert.equal(errors.length, 3, errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("/research/nothing-here")));
  assert.ok(errors.some((e) => e.includes("draft or scheduled post")));
  assert.ok(errors.some((e) => e.includes("#Nope")));
});

/* The legal pages (job_044f96426efa): /privacy is a registered page like /terms, and the two alone may state a
 * `banner` (the one word "Draft") and a `last_updated` day, which the layout draws and the twin repeats. */
const withFields = (/** @type {string} */ fields) => (/** @type {string} */ raw) =>
  raw.replace(/^---\n/, `---\n${fields}\n`);

await test("legal pages: the banner is the one word Draft, the date is a real day, and no other page states either", async () => {
  assert.match(
    await refusal("terms", withFields("banner: Draft copy")),
    /the one word it may say is "Draft"/,
  );
  assert.match(
    await refusal("terms", withFields("last_updated: 2026-02-30")),
    /real day written YYYY-MM-DD/,
  );
  assert.match(
    await refusal("terms", withFields("last_updated: yesterday")),
    /real day written YYYY-MM-DD/,
  );
  assert.match(
    await refusal("research-phages", withFields("banner: Draft")),
    /belong to the legal pages/,
  );
  assert.match(
    await refusal("research-phages", withFields("last_updated: 2026-10-06")),
    /belong to the legal pages/,
  );
});
