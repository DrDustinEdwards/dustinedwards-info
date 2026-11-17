import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findWideDashes, renderBody } from "../app/lib/content/pipeline.mjs";
import { compilePage } from "../app/lib/pages/compile.mjs";
import {
  PHAGES_PAGE_PATH,
  TABLE_MARKER,
  compilePhage,
  expandPhagePage,
  expandPhageTokens,
  phageSetErrors,
  phageTableMarkdown,
  sortPhages,
} from "../app/lib/phages/compile.mjs";
import { buildPhages } from "../scripts/lib/phages.mjs";

/* The validation module every phage write runs (app/lib/phages/compile.mjs): build:content, sync:content, the
 * gates and the phage save. These cases show each rule firing, on a real phage file with one line changed, so a
 * rule that stopped firing would fail here instead of letting an edit through. They carry the checks that read
 * the rows and the PhagesDB map when those were code and a page (the table lists every phage, a link for exactly
 * the phages with a record, the sections, the order), now that the rows are files (docs/PHAGES.md). */

const dir = new URL("../content/phages/", import.meta.url);
const read = (/** @type {string} */ slug) => readFileSync(new URL(`${slug}.md`, dir), "utf8");
const pipeline = { findWideDashes };
const paperHost = { paper: async () => true };
/** Built from its code point, so this file carries no literal wide dash. */

const compile = (/** @type {string} */ slug, /** @type {string} */ raw, host = paperHost) =>
  compilePhage({ slug, raw, host, pipeline });

/**
 * The errors a changed file raises: asserts it was refused, and returns every message.
 *
 * @param {string} slug
 * @param {(raw: string) => string} mutate
 * @param {typeof paperHost} [host]
 */
async function refusal(slug, mutate, host = paperHost) {
  const raw = read(slug);
  const changed = mutate(raw);
  assert.notEqual(changed, raw, "the mutation changed nothing, so it proves nothing");
  const result = await compile(slug, changed, host);
  assert.equal(result.ok, false, `${slug} was accepted after the change`);
  return result.ok ? "" : result.errors.join("\n");
}

const { phages } = await buildPhages();

await test("front matter: only the table's fields, each in its shape", async () => {
  assert.match(
    await refusal("acorn15", (r) => r.replace("---\n", "---\nsample: soil\n")),
    /sample is not a phage field/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace("---\n", "---\nlocation: a farm\n")),
    /location is not a phage field.*no samples, locations beyond the county/,
  );
  assert.match(await refusal("acorn15", (r) => r.replace(/^host: .*$/m, "")), /host is required/);
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^county: .*$/m, "")),
    /county is required/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "")),
    /phagesdb is required/,
  );
  assert.match(await refusal("acorn15", (r) => r.replace(/^year: .*$/m, "year: 17")), /year is 17/);
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^year: .*$/m, "year: soon")),
    /year is "soon"/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^host: .*$/m, "host: ecoli")),
    /host is "ecoli"; it is smegmatis or foliorum/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^county: .*$/m, "county: Hood")),
    /county is "Hood"/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^county: .*$/m, "county: a private farm road")),
    /county is "a private farm road"/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^name: .*$/m, "name: Acorn 15")),
    /name is "Acorn 15"/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^name: .*$/m, "name: Allene")),
    /a phage's file is named for its name in lower case/,
  );
  assert.match(
    await refusal("acorn15", (r) => `${r}\nA body is not a phage.\n`),
    /body must be empty/,
  );
  assert.match(
    await refusal("acorn15", (r) => r.replace(/^---\n/, "")),
    /must start with a --- front matter block/,
  );
});

await test("the set: an empty set is a fault, two files cannot be one phage, and a record is one phage's", () => {
  assert.match(phageSetErrors([]).join(" "), /holds no phage files/);
  const a = /** @type {any} */ (phages[0]);
  const b = /** @type {any} */ (phages[1]);
  assert.match(phageSetErrors([a, { ...a }]).join(" "), /two files are the phage Acorn15/);
  assert.match(
    phageSetErrors([a, { ...b, phagesdb: a.phagesdb }]).join(" "),
    /claim the same PhagesDB record/,
  );
});

// The page: the table is drawn where the marker says, before anything reads the body.

const pageRaw = readFileSync(
  new URL("../content/pages/research-phages.md", import.meta.url),
  "utf8",
);
const compilePhagePage = (
  /** @type {string} */ raw,
  /** @type {typeof phages | undefined} */ rowsFor = phages,
) =>
  compilePage({
    slug: "research-phages",
    raw,
    pipeline: { renderBody, findWideDashes },
    phages: rowsFor,
  });

await test("the page file carries the marker once, and the compiled page is drawn from the rows", async () => {
  assert.equal(pageRaw.split(TABLE_MARKER).length - 1, 1);
  assert.doesNotMatch(pageRaw, /^\| /m, "no phage row is typed in the page's own file");
  const result = await compilePhagePage(pageRaw);
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("; "));
  if (!result.ok) return;
  // The twin and the HTML carry the table and no marker.
  assert.ok(result.markdown.includes(phageTableMarkdown(phages)));
  assert.doesNotMatch(result.markdown, /phages:table/);
  // Each row is the phage's anchor, which /research/phages#acorn15 and the old /discovery-of-acorn15 land on.
  assert.deepEqual(
    [...result.page.html.matchAll(/<td id="([^"]+)">/g)].map((m) => m[1]),
    sortPhages(phages).map((p) => p.name.toLowerCase()),
  );
  assert.equal(result.page.dataset?.rows, phages.length);
});

await test("a phage added to the rows is drawn into the page, its twin and its dataset facts, with nothing else changed", async () => {
  const added = {
    name: "Zeta",
    year: 2026,
    host: /** @type {const} */ ("foliorum"),
    county: "Erath County",
    phagesdb: null,
    paper: null,
    formerly: null,
    note: null,
  };
  const before = await compilePhagePage(pageRaw);
  const after = await compilePhagePage(pageRaw, [...phages, added]);
  assert.equal(before.ok && after.ok, true);
  if (!before.ok || !after.ok) return;
  assert.ok(after.markdown.includes("| Zeta | 2026 | *M. foliorum* | Erath County |  |  |"));
  assert.equal(after.page.dataset?.rows, phages.length + 1);
  assert.match(String(after.page.dataset?.temporalCoverage), /2026/);
  assert.doesNotMatch(String(before.page.dataset?.temporalCoverage), /2026/);
  // Everything the rows do not feed is as it was.
  assert.equal(after.page.title, before.page.title);
  assert.equal(after.page.description, before.page.description);
});

await test("the marker: exactly once and alone on its line, only on the phage page, and rows must exist", async () => {
  assert.equal(expandPhagePage("/research/other", "text", undefined).ok, true);
  assert.match(
    JSON.stringify(expandPhagePage("/research/other", `a\n${TABLE_MARKER}\n`, undefined)),
    /belongs on \/research\/phages only/,
  );
  assert.match(
    JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, "x\n", phages)),
    /exactly once.*it has 0/,
  );
  assert.match(
    JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `${TABLE_MARKER}\n${TABLE_MARKER}`, phages)),
    /exactly once.*it has 2/,
  );
  assert.match(
    JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `see ${TABLE_MARKER} inline`, phages)),
    /alone on its line/,
  );
  assert.match(
    JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, TABLE_MARKER, [])),
    /phages table is empty/,
  );
  const stray = await compilePage({
    slug: "research-publications",
    raw: `---\npath: /research/publications\ntitle: "x"\nseo_title: "x"\ndescription: "x"\n---\n\n${TABLE_MARKER}\n`,
    pipeline: { renderBody, findWideDashes },
  });
  assert.equal(stray.ok, false);
});

await test("the page's own text cannot undo the table: a hand-written PhagesDB link and a second table fail", async () => {
  const withProse = (/** @type {string} */ extra) =>
    pageRaw.replace("## All phages", `${extra}\n\n## All phages`);
  const link = await compilePhagePage(
    withProse("See [a record](https://phagesdb.org/phages/Nothing/)."),
  );
  assert.equal(link.ok, false);
  assert.match(link.ok ? "" : link.errors.join(" "), /PhagesDB link outside the verified records/);
  const table = await compilePhagePage(
    withProse("| a | b |\n|---|---|\n| [Acorn15](#acorn15) | 1 |"),
  );
  assert.equal(table.ok, false);
  assert.match(table.ok ? "" : table.errors.join(" "), /first table on the page/);
});

await test("phage tokens read the rows, format numbers, and refuse a name that names nothing", () => {
  const rows = /** @type {any[]} */ (phages);
  const ok = (/** @type {string} */ text) => {
    const result = expandPhageTokens(text, rows);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.ok ? result.text : "";
  };
  assert.equal(ok("{{phages.count}}"), String(phages.length));
  assert.equal(
    ok("{{ phages.firstYear }} to {{phages.lastYear}}"),
    `${phages[0]?.year} to ${phages[phages.length - 1]?.year}`,
  );
  assert.equal(ok("{{phages.host.smegmatis.years}}"), "2017");
  assert.equal(
    ok("{{phage.loca.bp}} bp, {{phage.loca.genes}} genes in {{phage.loca.county}}"),
    "17,475 bp, 25 genes in Erath County",
  );
  assert.equal(ok("{{phages.commonCounty(godfather,fizzles,loca,indylu)}}"), "Erath County");
  for (const bad of [
    "{{phages.count2}}",
    "{{phage.nobody.bp}}",
    "{{phage.acorn15.genes}}",
    "{{phages.host.nowhere.count}}",
    "{{phages.commonCounty(godfather,finny)}}",
  ]) {
    const result = expandPhageTokens(bad, rows);
    assert.equal(result.ok, false, `${bad} was accepted`);
  }
  assert.equal(
    expandPhageTokens("{{phages.count}}", undefined).ok,
    false,
    "a token with no rows loaded is an error, not an empty string",
  );
  assert.deepEqual(expandPhageTokens("plain text", undefined), { ok: true, text: "plain text" });
});
