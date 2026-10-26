import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { findWideDashes, renderBody } from "../app/lib/content/pipeline.mjs";
import { compilePage } from "../app/lib/pages/compile.mjs";
import {
  HOSTS,
  PHAGES_PAGE_PATH,
  PHAGE_FACT_PAGES,
  TABLE_MARKER,
  compilePhage,
  expandPhagePage,
  expandPhageTokens,
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

await test("every phage file compiles against the repository's papers, and the set is a table", () => {
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  assert.equal(files.length, rows.length);
  assert.deepEqual(phageSetErrors(phages), []);
  assert.equal(phages.length, 75);
});

await test("the files are in the page's order: year, then name, with the slug the name in lower case", () => {
  assert.deepEqual(phages.map((p) => p.name), sortPhages(phages).map((p) => p.name));
  for (const row of rows) assert.equal(row.slug, row.name.toLowerCase());
  const years = phages.map((p) => p.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  const names = phages.filter((p) => p.year === 2022).map((p) => p.name);
  assert.deepEqual(names.slice(0, 4), ["Besitos", "CutiePie", "DaddyP", "DJDoc"], "case-folded: DaddyP before DJDoc");
});

await test("a row carries every fact the phage has, a former name and a note included, as the table is the only list", () => {
  const by = (/** @type {string} */ name) => phages.find((p) => p.name === name);
  assert.equal(
    phageTableRow(/** @type {any} */ (by("Ryadel"))),
    "| Ryadel | 2017 | *M. smegmatis* mc²155 | Erath County | [PhagesDB](https://phagesdb.org/phages/Ryadel/) | [Paper](/research/publications/10-1128-mra-01594-18/) A manuscript on its cryo-EM structure is submitted. |",
  );
  assert.match(phageTableRow(/** @type {any} */ (by("Strudel"))), /^\| Strudel \(formerly Jentrie\) \| 2017 \|/);
  // A county PhagesDB does not give is an empty cell. Every shipped phage has a county now, so the empty case is
  // Fambo's record with the county removed.
  const noCounty = /** @type {any} */ ({ ...by("Fambo"), county: null });
  assert.equal(phageTableRow(noCounty), "| Fambo | 2022 | *M. foliorum* |  | [PhagesDB](https://phagesdb.org/phages/Fambo/) |  |");
  assert.ok(phageTableMarkdown(phages).startsWith("| Phage | Year | Host | County | PhagesDB | Paper |\n|---|---|---|---|---|---|\n| Acorn15 |"));
});

await test("front matter: only the table's fields, each in its shape", async () => {
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

await test("PhagesDB: the record's format, and that it is this phage's own", async () => {
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "phagesdb: Acorn 15")), /phagesdb is "Acorn 15"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "phagesdb: ../etc")), /phagesdb is "\.\.\/etc"/);
  assert.match(await refusal("acorn15", (r) => r.replace(/^phagesdb: .*$/m, "phagesdb: Fambo")), /which is not Acorn15's record/);
  // A record equal to the name apart from case is the same record.
  assert.equal((await compile("softsoap", read("softsoap"))).ok, true);
  // A phage with no verified record carries null, and links nothing.
  const unlinked = await compile("acorn15", read("acorn15").replace(/^phagesdb: .*$/m, "phagesdb: null"));
  assert.equal(unlinked.ok, true);
  assert.doesNotMatch(unlinked.ok ? phageTableRow(unlinked.phage) : "", /phagesdb/);
});

await test("the genome paper is a paper the site holds, and the note is one plain sentence", async () => {
  assert.match(await refusal("arlo", (r) => r.replace(/^paper: .*$/m, "paper: Not A Slug")), /paper is "Not A Slug"/);
  const missing = await compile("arlo", read("arlo"), { paper: async () => false });
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? "" : missing.errors.join(" "), /paper 10-1128-mra-01242-18 is not a publication of this site/);
  assert.match(await refusal("ryadel", (r) => r.replace(/^note: .*$/m, "note: See [this](https://example.org) now.")), /note is .*no links or markdown/);
  assert.match(await refusal("ryadel", (r) => r.replace(/^note: .*$/m, "note: lower case start.")), /note is /);
  assert.match(await refusal("strudel", (r) => r.replace(/^formerly: .*$/m, "formerly: Two Words")), /formerly is "Two Words"/);
});

await test("prose rules: a wide dash fails", async () => {
  assert.match(await refusal("ryadel", (r) => r.replace(/^note: (.*)$/m, `note: $1 ${WIDE_DASH}`)), /wide dash/);
});

await test("the set: an empty set is a fault, two files cannot be one phage, and a record is one phage's", () => {
  assert.match(phageSetErrors([]).join(" "), /holds no phage files/);
  const a = /** @type {any} */ (phages[0]);
  const b = /** @type {any} */ (phages[1]);
  assert.match(phageSetErrors([a, { ...a }]).join(" "), /two files are the phage Acorn15/);
  assert.match(phageSetErrors([a, { ...b, phagesdb: a.phagesdb }]).join(" "), /claim the same PhagesDB record/);
});

await test("every file, compiled one at a time, is the compile the build ran", async () => {
  const all = await compileAllPhages();
  assert.equal(all.every((c) => c.compiled.ok), true);
});

await test("the repository host: a paper is a file under content/publications", async () => {
  assert.equal(await repoHost.paper("10-1128-mra-01242-18"), true);
  assert.equal(await repoHost.paper("no-such-paper"), false);
});

// The page: the table is drawn where the marker says, before anything reads the body.

const pageRaw = readFileSync(new URL("../content/pages/research-phages.md", import.meta.url), "utf8");
const compilePhagePage = (/** @type {string} */ raw, /** @type {typeof phages | undefined} */ rowsFor = phages) =>
  compilePage({ slug: "research-phages", raw, pipeline: { renderBody, findWideDashes }, phages: rowsFor });

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
  assert.deepEqual([...result.page.html.matchAll(/<td id="([^"]+)">/g)].map((m) => m[1]), sortPhages(phages).map((p) => p.name.toLowerCase()));
  assert.equal(result.page.dataset?.rows, phages.length);
});

await test("a phage added to the rows is drawn into the page, its twin and its dataset facts, with nothing else changed", async () => {
  const added = { name: "Zeta", year: 2026, host: /** @type {const} */ ("foliorum"), county: "Erath County", phagesdb: null, paper: null, formerly: null, note: null };
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
  assert.match(JSON.stringify(expandPhagePage("/research/other", `a\n${TABLE_MARKER}\n`, undefined)), /belongs on \/research\/phages only/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, "x\n", phages)), /exactly once.*it has 0/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `${TABLE_MARKER}\n${TABLE_MARKER}`, phages)), /exactly once.*it has 2/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, `see ${TABLE_MARKER} inline`, phages)), /alone on its line/);
  assert.match(JSON.stringify(expandPhagePage(PHAGES_PAGE_PATH, TABLE_MARKER, [])), /phages table is empty/);
  const stray = await compilePage({
    slug: "research-publications",
    raw: `---\npath: /research/publications\ntitle: "x"\nseo_title: "x"\ndescription: "x"\n---\n\n${TABLE_MARKER}\n`,
    pipeline: { renderBody, findWideDashes },
  });
  assert.equal(stray.ok, false);
});

await test("the page's own text cannot undo the table: a hand-written PhagesDB link and a second table fail", async () => {
  const withProse = (/** @type {string} */ extra) => pageRaw.replace("## All phages", `${extra}\n\n## All phages`);
  const link = await compilePhagePage(withProse("See [a record](https://phagesdb.org/phages/Nothing/)."));
  assert.equal(link.ok, false);
  assert.match(link.ok ? "" : link.errors.join(" "), /PhagesDB link outside the verified records/);
  const table = await compilePhagePage(withProse("| a | b |\n|---|---|\n| [Acorn15](#acorn15) | 1 |"));
  assert.equal(table.ok, false);
  assert.match(table.ok ? "" : table.errors.join(" "), /first table on the page/);
});

await test("the table has a PhagesDB link for exactly the phages with a verified record, and no other", async () => {
  const result = await compilePhagePage(pageRaw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const withRecord = phages.filter((p) => p.phagesdb !== null).length;
  assert.equal([...result.page.html.matchAll(/href="https:\/\/phagesdb\.org[^"]*"/g)].length, withRecord);
});

await test("the page states the count and the span its rows give, by token, so an added phage updates it", async () => {
  assert.doesNotMatch(pageRaw, /\b\d+ phages\b/, "the intro types no count: a token reads it from the rows");
  const result = await compilePhagePage(pageRaw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const text = result.markdown;
  assert.match(text, new RegExp(`It has ${phages.length} phages found from ${phages[0]?.year} to ${phages[phages.length - 1]?.year}\\.`));
  assert.match(text, new RegExp(`The ${phages.filter((p) => p.year === 2017).length} phages from 2017`));
  assert.match(text, new RegExp(`${phages.filter((p) => p.host === "foliorum").length} of them`));
  assert.equal(phages.filter((p) => p.host === null).length, 0, "the intro no longer says any phage lacks a host");
  assert.doesNotMatch(text, /\{\{/, "no token is left unexpanded");
});

await test("every phage fact a page states is a token: no page types a count of phages, and the list of token pages is exact", () => {
  const pagesDir = new URL("../content/pages/", import.meta.url);
  const using = [];
  for (const file of readdirSync(pagesDir).filter((name) => name.endsWith(".md"))) {
    const raw = readFileSync(new URL(file, pagesDir), "utf8");
    assert.doesNotMatch(raw, /\b[0-9][0-9,]*\s+(?:bacterio)?phages?\b/, `${file} types a count of phages; use {{phages.count}} or a host count`);
    if (raw.includes("{{phage")) using.push(file);
  }
  const listed = PHAGE_FACT_PAGES.map((path) => `${path.slice(1).replaceAll("/", "-")}.md`);
  const others = using.filter((file) => file !== "research-phages.md").sort();
  assert.deepEqual(others, [...listed].sort(), "PHAGE_FACT_PAGES is every page that uses a token, besides the table's: a phage write refreshes exactly these");
});

await test("phage tokens read the rows, format numbers, and refuse a name that names nothing", () => {
  const rows = /** @type {any[]} */ (phages);
  const ok = (/** @type {string} */ text) => {
    const result = expandPhageTokens(text, rows);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.ok ? result.text : "";
  };
  assert.equal(ok("{{phages.count}}"), String(phages.length));
  assert.equal(ok("{{ phages.firstYear }} to {{phages.lastYear}}"), `${phages[0]?.year} to ${phages[phages.length - 1]?.year}`);
  assert.equal(ok("{{phages.host.smegmatis.years}}"), "2017");
  assert.equal(ok("{{phage.loca.bp}} bp, {{phage.loca.genes}} genes in {{phage.loca.county}}"), "17,475 bp, 25 genes in Erath County");
  assert.equal(ok("{{phages.commonCounty(godfather,fizzles,loca,indylu)}}"), "Erath County");
  for (const bad of ["{{phages.count2}}", "{{phage.nobody.bp}}", "{{phage.acorn15.genes}}", "{{phages.host.nowhere.count}}", "{{phages.commonCounty(godfather,finny)}}"]) {
    const result = expandPhageTokens(bad, rows);
    assert.equal(result.ok, false, `${bad} was accepted`);
  }
  assert.equal(expandPhageTokens("{{phages.count}}", undefined).ok, false, "a token with no rows loaded is an error, not an empty string");
  assert.deepEqual(expandPhageTokens("plain text", undefined), { ok: true, text: "plain text" });
});

await test("the genome fields are whole numbers in range, or absent", async () => {
  const bad = async (/** @type {string} */ line) => (await refusal("loca", (raw) => raw.replace("genes: 25", line)));
  assert.match(await bad("genes: 0"), /genes is 0/);
  assert.match(await bad("genes: 2.5"), /genes is 2\.5/);
  assert.match(await bad("genes: many"), /genes is "many"/);
  assert.match(await refusal("loca", (raw) => raw.replace("genome_bp: 17475", "genome_bp: 12")), /genome_bp is 12/);
  const result = await compile("loca", read("loca"));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([result.phage.genomeBp, result.phage.genes], [17475, 25]);
});

await test("the hosts the table names are the two the page's prose names", () => {
  assert.deepEqual(Object.keys(HOSTS), ["smegmatis", "foliorum"]);
  assert.equal(PHAGES_DIR, "content/phages");
});
