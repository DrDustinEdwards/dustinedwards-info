import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { findWideDashes, renderBody } from "../app/lib/content/pipeline.mjs";
import { compilePage } from "../app/lib/pages/compile.mjs";
import {
  HOSTS,
  PHAGES_PAGE_PATH,
  SECTIONS_MARKER,
  TABLE_MARKER,
  compilePhage,
  expandPhagePage,
  phageSection,
  phageSetErrors,
  phageTableMarkdown,
  phageTableRow,
  sortPhages,
} from "../app/lib/phages/compile.mjs";
import { PHAGES_DIR } from "../app/lib/phages/compile.mjs";
import { buildPhages, compileAllPhages, repoHost } from "../scripts/lib/phages.mjs";

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
const WIDE_DASH = String.fromCharCode(0x2014);

const compile = (/** @type {string} */ slug, /** @type {string} */ raw, host = paperHost) => compilePhage({ slug, raw, host, pipeline });

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

const { phages, rows } = await buildPhages();

test("every phage file compiles against the repository's papers, and the set is a table", () => {
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  assert.equal(files.length, rows.length);
  assert.deepEqual(phageSetErrors(phages), []);
  assert.equal(phages.length, 80);
});

test("the files are in the page's order: year, then name, with the slug the name in lower case", () => {
  assert.deepEqual(phages.map((p) => p.name), sortPhages(phages).map((p) => p.name));
  for (const row of rows) assert.equal(row.slug, row.name.toLowerCase());
  const years = phages.map((p) => p.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  const names = phages.filter((p) => p.year === 2022).map((p) => p.name);
  assert.deepEqual(names.slice(0, 4), ["Besitos", "CutiePie", "DaddyP", "DJDoc"], "case-folded: DaddyP before DJDoc");
});

test("a row and a section say what the page has always said", () => {
  const by = (/** @type {string} */ name) => phages.find((p) => p.name === name);
  assert.equal(
    phageTableRow(/** @type {any} */ (by("Ryadel"))),
    "| [Ryadel](#ryadel) | 2017 | *M. smegmatis* mc²155 | Erath County | [PhagesDB](https://phagesdb.org/phages/Ryadel/) | [Paper](/research/publications/10-1128-mra-01594-18/) |",
  );
  assert.equal(
    phageSection(/** @type {any} */ (by("Ryadel"))),
    "### Ryadel\n\nHost: *Mycobacterium smegmatis* mc²155. Found in 2017, Erath County, Texas.\n\n" +
      "[Ryadel on PhagesDB](https://phagesdb.org/phages/Ryadel/). [Genome announcement](/research/publications/10-1128-mra-01594-18/). A manuscript on its cryo-EM structure is submitted.",
  );
  // Empty cells are empty, a missing host drops its line, and a state-only place reads "Texas".
  assert.equal(phageTableRow(/** @type {any} */ (by("Astrid"))), "| [Astrid](#astrid) | 2018 |  |  |  |  |");
  assert.equal(phageSection(/** @type {any} */ (by("Astrid"))), "### Astrid\n\nFound in 2018.");
  assert.equal(phageSection(/** @type {any} */ (by("Lucinda"))).split("\n")[2], "Host: *Mycobacterium smegmatis* mc²155. Found in 2017, Texas.");
  // SoftSoap's record is spelled Softsoap on PhagesDB: the link text is the phage, the address is the record.
  assert.match(phageSection(/** @type {any} */ (by("SoftSoap"))), /\[SoftSoap on PhagesDB\]\(https:\/\/phagesdb\.org\/phages\/Softsoap\/\)/);
  assert.match(phageSection(/** @type {any} */ (by("Strudel"))), /Found in 2017, Tarrant County, Texas\. Formerly named Jentrie\./);
  assert.ok(phageTableMarkdown(phages).startsWith("| Phage | Year | Host | County | PhagesDB | Paper |\n|---|---|---|---|---|---|\n| [Acorn15](#acorn15)"));
});

test("front matter: only the table's fields, each in its shape", async () => {
  assert.match(await refusal("acorn15", (r) => r.replace("---\n", "---\nsample: soil\n")), /sample is not a phage field/);
  assert.match(await refusal("acorn15", (r) => r.replace("---\n", "---\nlocation: a farm\n")), /location is not a phage field.*no samples, locations beyond the county/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^host: .*$/m, "")), /host is required/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^county: .*$/m, "")), /county is required/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "")), /phagesdb is required/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^year: .*$/m, "year: 17")), /year is 17/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^year: .*$/m, "year: soon")), /year is "soon"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^host: .*$/m, "host: ecoli")), /host is "ecoli"; it is smegmatis or foliorum/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^county: .*$/m, "county: Hood")), /county is "Hood"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^county: .*$/m, "county: a private farm road")), /county is "a private farm road"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^name: .*$/m, "name: Acorn 15")), /name is "Acorn 15"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^name: .*$/m, "name: Allene")), /a phage's file is named for its name in lower case/);
  assert.match(await refusal("acorn15", (r) => `${r}\nA body is not a phage.\n`), /body must be empty/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^---\n/, "")), /must start with a --- front matter block/);
});

test("PhagesDB: the record's format, and that it is this phage's own", async () => {
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "phagesdb: Acorn 15")), /phagesdb is "Acorn 15"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "phagesdb: ../etc")), /phagesdb is "\.\.\/etc"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "phagesdb: Fambo")), /which is not Acorn15's record/);
  // SoftSoap's record differs from its name in case alone, which is the same record.
  assert.equal((await compile("softsoap", read("softsoap"))).ok, true);
  // A phage with no verified record carries null, and links nothing.
  assert.equal((await compile("jaykay", read("jaykay"))).ok, true);
  assert.doesNotMatch(phageTableRow(/** @type {any} */ (phages.find((p) => p.name === "JayKay"))), /phagesdb/);
});

test("the genome paper is a paper the site holds, and the note is one plain sentence", async () => {
  assert.match(await refusal("arlo", (r) => r.replace(/^paper: .*$/m, "paper: Not A Slug")), /paper is "Not A Slug"/);
  const missing = await compile("arlo", read("arlo"), { paper: async () => false });
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? "" : missing.errors.join(" "), /paper 10-1128-mra-01242-18 is not a publication of this site/);
  assert.match(await refusal("ryadel", (r) => r.replace(/^note: .*$/m, "note: See [this](https://example.org) now.")), /note is .*no links or markdown/);
  assert.match(await refusal("ryadel", (r) => r.replace(/^note: .*$/m, "note: lower case start.")), /note is /);
  assert.match(await refusal("strudel", (r) => r.replace(/^formerly: .*$/m, "formerly: Two Words")), /formerly is "Two Words"/);
});

test("prose rules: a wide dash fails", async () => {
  assert.match(await refusal("ryadel", (r) => r.replace(/^note: (.*)$/m, `note: $1 ${WIDE_DASH}`)), /wide dash/);
});

test("the set: an empty set is a fault, two files cannot be one phage, and a record is one phage's", () => {
  assert.match(phageSetErrors([]).join(" "), /holds no phage files/);
  const a = /** @type {any} */ (phages[0]);
  const b = /** @type {any} */ (phages[1]);
  assert.match(phageSetErrors([a, { ...a }]).join(" "), /two files are the phage Acorn15/);
  assert.match(phageSetErrors([a, { ...b, phagesdb: a.phagesdb }]).join(" "), /claim the same PhagesDB record/);
});

test("every file, compiled one at a time, is the compile the build ran", async () => {
  const all = await compileAllPhages();
  assert.equal(all.every((c) => c.compiled.ok), true);
});

test("the repository host: a paper is a file under content/publications", async () => {
  assert.equal(await repoHost.paper("10-1128-mra-01242-18"), true);
  assert.equal(await repoHost.paper("no-such-paper"), false);
});

// The page: the table and sections are drawn where the markers say, before anything reads the body.

const pageRaw = readFileSync(new URL("../content/pages/research-phages.md", import.meta.url), "utf8");
const compilePhagePage = (/** @type {string} */ raw, /** @type {typeof phages | undefined} */ rowsFor = phages) =>
  compilePage({ slug: "research-phages", raw, pipeline: { renderBody, findWideDashes }, phages: rowsFor });

test("the page file carries each marker once, and the compiled page is drawn from the rows", async () => {
  assert.equal(pageRaw.split(TABLE_MARKER).length - 1, 1);
  assert.equal(pageRaw.split(SECTIONS_MARKER).length - 1, 1);
  assert.doesNotMatch(pageRaw, /^\| \[/m, "no phage row is typed in the page's own file");
  assert.doesNotMatch(pageRaw, /^### /m, "no phage section is typed in the page's own file");
  const result = await compilePhagePage(pageRaw);
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("; "));
  if (!result.ok) return;
  // The twin and the HTML carry the table, the sections and their headings, and no marker.
  assert.ok(result.markdown.includes(phageTableMarkdown(phages)));
  assert.doesNotMatch(result.markdown, /phages:(table|sections)/);
  assert.equal([...result.page.html.matchAll(/<h3 id="[^"]+">/g)].length, phages.length);
  assert.equal(result.page.dataset?.rows, phages.length);
});

test("a phage added to the rows is drawn into the page, its twin and its dataset facts, with nothing else changed", async () => {
  const added = { name: "Zeta", year: 2026, host: /** @type {const} */ ("foliorum"), county: "Erath County", phagesdb: null, paper: null, formerly: null, note: null };
  const before = await compilePhagePage(pageRaw);
  const after = await compilePhagePage(pageRaw, [...phages, added]);
  assert.equal(before.ok && after.ok, true);
  if (!before.ok || !after.ok) return;
  assert.ok(after.markdown.includes("| [Zeta](#zeta) | 2026 | *M. foliorum* | Erath County |  |  |"));
  assert.ok(after.markdown.endsWith("### Zeta\n\nHost: *Microbacterium foliorum*. Found in 2026, Erath County, Texas.\n"));
  assert.equal(after.page.dataset?.rows, phages.length + 1);
  assert.match(after.page.html, /<h3 id="zeta">Zeta/);
  assert.match(String(after.page.dataset?.temporalCoverage), /2026/);
  assert.doesNotMatch(String(before.page.dataset?.temporalCoverage), /2026/);
  // Everything the rows do not feed is as it was.
  assert.equal(after.page.title, before.page.title);
  assert.equal(after.page.description, before.page.description);
});

test("the markers: each exactly once and alone on its line, only on the phage page, and rows must exist", async () => {
  assert.equal(expandPhagePage("/research/other", "text", undefined).ok, true);
  assert.match(JSON.stringify(expandPhagePage("/research/other", `a\n${TABLE_MARKER}\n`, undefined)), /belongs on \/research\/phages only/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `x\n${SECTIONS_MARKER}\n`, phages)), /exactly once.*it has 0/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `${TABLE_MARKER}\n${TABLE_MARKER}\n${SECTIONS_MARKER}`, phages)), /exactly once.*it has 2/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `see ${TABLE_MARKER} inline\n${SECTIONS_MARKER}`, phages)), /alone on its line/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `${TABLE_MARKER}\n${SECTIONS_MARKER}`, [])), /phages table is empty/);
  const stray = await compilePage({
    slug: "research-publications",
    raw: `---\npath: /research/publications\ntitle: "x"\nseo_title: "x"\ndescription: "x"\n---\n\n${TABLE_MARKER}\n`,
    pipeline: { renderBody, findWideDashes },
  });
  assert.equal(stray.ok, false);
});

test("the page's own text cannot undo the table: a hand-written PhagesDB link, a second table and a repeated heading fail", async () => {
  const withProse = (/** @type {string} */ extra) => pageRaw.replace("## All phages", `${extra}\n\n## All phages`);
  const link = await compilePhagePage(withProse("See [a record](https://phagesdb.org/phages/Nothing/)."));
  assert.equal(link.ok, false);
  assert.match(link.ok ? "" : link.errors.join(" "), /PhagesDB link outside the verified records/);
  const table = await compilePhagePage(withProse("| a | b |\n|---|---|\n| [Acorn15](#acorn15) | 1 |"));
  assert.equal(table.ok, false);
  assert.match(table.ok ? "" : table.errors.join(" "), /first table on the page/);
  const heading = await compilePhagePage(pageRaw.replace(SECTIONS_MARKER, `### Acorn15\n\n${SECTIONS_MARKER}`));
  assert.equal(heading.ok, false);
  assert.match(heading.ok ? "" : heading.errors.join(" "), /Acorn15 has 2 ### sections/);
});

test("the table has a PhagesDB link for exactly the phages with a verified record, and no other", async () => {
  const result = await compilePhagePage(pageRaw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const withRecord = phages.filter((p) => p.phagesdb !== null).length;
  assert.equal([...result.page.html.matchAll(/href="https:\/\/phagesdb\.org[^"]*"/g)].length, withRecord * 2, "one link in the table, one in the section");
  for (const p of phages.filter((p) => p.phagesdb === null)) {
    assert.doesNotMatch(result.markdown.split(`\n### ${p.name}\n`)[1]?.split("\n### ")[0] ?? "", /phagesdb\.org/);
  }
});

test("the page states the count and the span its rows give, so an edit that adds a phage reminds the writer", () => {
  const text = pageRaw;
  assert.match(text, new RegExp(`It has ${phages.length} phages found from ${phages[0]?.year} to ${phages[phages.length - 1]?.year}\\.`));
  assert.match(text, new RegExp(`The ${phages.filter((p) => p.year === 2017).length} phages from 2017`));
  assert.match(text, new RegExp(`${phages.filter((p) => p.host === "foliorum").length} of them`));
  const noHost = phages.filter((p) => p.host === null).length;
  assert.match(text, noHost === 2 ? /Two phages have no host on record/ : /./);
});

test("the hosts the table names are the two the page's prose names", () => {
  assert.deepEqual(Object.keys(HOSTS), ["smegmatis", "foliorum"]);
  assert.equal(PHAGES_DIR, "content/phages");
});
