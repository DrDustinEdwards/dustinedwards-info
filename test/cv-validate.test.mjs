// The CV's validation module (app/lib/cv/validate.mjs, compile.mjs) showing each rule fire: the tests that read
// app/data/cv.ts are these rules now, held by the build, the sync and the CV save alike (docs/CV.md).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { assembleCvSource, compileCv, compileCvFile } from "../app/lib/cv/compile.mjs";
import { CV_FILES, cvSourcePath } from "../app/lib/cv/parse.mjs";
import { cvTwin } from "../app/lib/cv/markdown.mjs";
import { orderErrors } from "../app/lib/cv/validate.mjs";
import { buildPublications } from "../scripts/lib/publications.mjs";

const PUBLICATIONS = (await buildPublications()).records;
const read = (slug) => readFileSync(new URL(`../${cvSourcePath(slug)}`, import.meta.url), "utf8");

/** Built from its code point, so this file holds no dash of its own. */
const EM_DASH = String.fromCharCode(0x2014);

/** The errors a file's text produces, or [] when it compiles. */
async function errorsOf(slug, raw) {
  const compiled = await compileCvFile({ slug, raw, publications: PUBLICATIONS });
  return compiled.ok ? [] : compiled.errors;
}

const GRANT = "  - year: 2026\n    amount: 10\n    title: A grant\n    areas: []\n    role: recipient\n";

test("every file in the repository compiles, and the whole is a CV", async () => {
  const records = [];
  for (const { slug } of CV_FILES) {
    const compiled = await compileCvFile({ slug, raw: read(slug), publications: PUBLICATIONS });
    assert.ok(compiled.ok, `${slug}: ${compiled.errors?.join("; ")}`);
    records.push(compiled.record);
  }
  const whole = compileCv({ records, publications: PUBLICATIONS });
  assert.ok(whole.ok, whole.errors?.join("; "));
  assert.match(cvTwin(whole.cv), /^# Curriculum Vitae\n\n/);
});

test("a file that is not in the registry is refused, and a save cannot create one", async () => {
  const errors = await errorsOf("brand-new", read("grants"));
  assert.match(errors.join("\n"), /is not a CV file/);
  assert.match(errors.join("\n"), /cannot create a new one/);
});

test("the front matter must be YAML, and the file is the front matter alone", async () => {
  assert.match((await errorsOf("grants", "---\nentries: [unclosed\n---\n")).join("\n"), /not valid YAML/);
  assert.match((await errorsOf("profile", `${read("profile")}\nSome text.\n`)).join("\n"), /text after its front matter/);
});

test("a section file states its own type, a non-empty list, and no field it does not know", async () => {
  const grants = read("grants");
  assert.match((await errorsOf("grants", grants.replace("type: grant", "type: talk"))).join("\n"), /holds grant entries/);
  assert.match((await errorsOf("grants", "---\ntype: grant\nentries: []\n---\n")).join("\n"), /non-empty list/);
  assert.match((await errorsOf("grants", grants.replace("type: grant\n", "type: grant\nextra: 1\n"))).join("\n"), /"extra" is not a field/);
  assert.match((await errorsOf("grants", grants.replace("title: Student Research Grant", "title: Student Research Grant\n    surprise: yes"))).join("\n"), /"surprise" is not a field of a grant entry/);
  assert.match((await errorsOf("grants", grants.replace("  - year: 2026\n", "  - type: grant\n    year: 2026\n"))).join("\n"), /does not state its type/);
});

test("an entry's dates: a year in range, an endYear that is not before it, and null only for an undated line", async () => {
  const grants = read("grants");
  const withFirst = (text) => grants.replace("entries:\n", `entries:\n${text}`);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("2026", "2205")))).join("\n"), /year must be a whole year from 1950 to 2100/);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("role: recipient", "endYear: 2020\n    role: recipient")))).join("\n"), /endYear 2020 is before year 2026/);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("year: 2026", "year: null").replace("role: recipient", "endYear: 2030\n    role: recipient")))).join("\n"), /undated line .* has no endYear/);
  assert.deepEqual(await errorsOf("grants", withFirst(GRANT.replace("role: recipient", "endYear: present\n    role: recipient"))), []);
});

test("areas and roles come from the site's lists, and amounts are dollars to the cent", async () => {
  const grants = read("grants");
  const withFirst = (text) => grants.replace("entries:\n", `entries:\n${text}`);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("areas: []", "areas: [cooking]")))).join("\n"), /areas must be a list/);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("recipient", "boss")))).join("\n"), /role must be null or one of/);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("amount: 10", "amount: 10.001")))).join("\n"), /amount must be dollars/);
  assert.match((await errorsOf("grants", withFirst(GRANT.replace("title: A grant", "title: ' padded '")))).join("\n"), /title must be non-empty text/);
});

test("the edition stamp is a season and a year", async () => {
  const profile = read("profile");
  assert.match((await errorsOf("profile", profile.replace("edition: Fall 2026", "edition: Autumn 26"))).join("\n"), /season and a year/);
  assert.deepEqual(await errorsOf("profile", profile.replace("edition: Fall 2026", "edition: Spring 2027")), []);
  assert.match((await errorsOf("profile", profile.replace("name: Dustin Edwards", "name: D. Edwards"))).join("\n"), /the site's one name/);
  assert.match((await errorsOf("profile", profile.replace("from: 2004", "from: 2030"))).join("\n"), /presentations.from is after presentations.to/);
});

test("privacy: no email, phone, room or private group, and mentoring is counts with no name field", async () => {
  const grants = read("grants");
  const withNote = (note) => grants.replace("note: with a student researcher", `note: ${note}`);
  assert.match((await errorsOf("grants", withNote("write to someone@example.com"))).join("\n"), /an email address/);
  assert.match((await errorsOf("grants", withNote("call 254-555-0100"))).join("\n"), /a phone number/);
  assert.match((await errorsOf("grants", withNote("Room 214"))).join("\n"), /a room/);
  assert.match((await errorsOf("grants", withNote("Mountains Lake group"))).join("\n"), /a private community group/);
  const mentoring = read("mentoring");
  assert.match(
    (await errorsOf("mentoring", mentoring.replace("count:", "student: Someone Named\n    count:"))).join("\n"),
    /"student" is not a field of a mentoring entry/,
  );
  // A comment explaining the rule is not a value, so it does not trip it.
  assert.deepEqual(await errorsOf("grants", grants.replace("---\n", "---\n# never an email such as a@b.co\n")), []);
});

test("the house style: no wide dash anywhere in a file", async () => {
  const errors = await errorsOf("grants", read("grants").replace("title: Student Research Grant", `title: Student ${EM_DASH} Research Grant`));
  assert.match(errors.join("\n"), /wide dash U\+2014/);
});

test("a paper named by DOI states nothing else, exists as a published record, appears once, and lists the owner", async () => {
  const publications = read("publications");
  const first = /- doi: (\S+)/.exec(publications)?.[1];
  assert.ok(first);
  const add = (text) => publications.replace("entries:\n", `entries:\n${text}`);
  assert.match((await errorsOf("publications", add("  - doi: 10.9999/missing\n"))).join("\n"), /no published publication has DOI 10\.9999\/missing/);
  assert.match((await errorsOf("publications", add(`  - doi: ${first}\n`))).join("\n"), /is listed twice/);
  assert.match((await errorsOf("publications", add(`  - doi: ${first}\n    title: Overridden\n`))).join("\n"), /states nothing else \(title\)/);
  assert.match((await errorsOf("publications", add("  - doi: not-a-doi\n"))).join("\n"), /is not a DOI/);
  // A published record the owner is not an author of cannot be claimed.
  const stranger = { ...PUBLICATIONS[0], doi: "10.9999/stranger", authors: ["Someone Else"] };
  const compiled = await compileCvFile({ slug: "publications", raw: add("  - doi: 10.9999/stranger\n"), publications: [...PUBLICATIONS, stranger] });
  assert.ok(!compiled.ok);
  assert.match(compiled.errors.join("\n"), /does not list Dustin Edwards among its authors/);
});

test("an inline paper carries its own citation and no more than the fields of one", async () => {
  const publications = read("publications");
  const inline = "  - year: 2001\n    areas: []\n    role: co-author\n    title: A paper the site holds no record of\n    authors: [A. Author, D. Edwards]\n    journal: A Journal\n";
  const asLast = publications.trimEnd().replace(/\n---$/, "") + `\n${inline}---\n`;
  assert.deepEqual(await errorsOf("publications", asLast), []);
  assert.match((await errorsOf("publications", asLast.replace("journal: A Journal", "journal: A Journal\n    pubmed: 1"))).join("\n"), /"pubmed" is not a field of a publication entry/);
});

test("each section reads newest first and undated lines last, judged on the resolved entries", () => {
  const e = (id, type, year, section = null) => ({ id, type, section, year });
  assert.deepEqual(orderErrors([e("a", "grant", 2020), e("b", "grant", 2020), e("c", "grant", 2019), e("d", "grant", null)]), []);
  assert.match(orderErrors([e("a", "grant", 2019), e("b", "grant", 2020)]).join("\n"), /b \(2020\) follows a \(2019\); each section reads newest first/);
  assert.match(orderErrors([e("a", "talk", null), e("b", "talk", 2020)]).join("\n"), /undated lines come last/);
  // Sections are judged apart, and service and mentoring keep the CV's own order within one.
  assert.deepEqual(orderErrors([e("a", "appointment", 2020, "Positions"), e("b", "appointment", 2025, "Administrative and leadership")]), []);
  assert.deepEqual(orderErrors([e("a", "service", 2015, "Department"), e("b", "service", 2023, "Department")]), []);
});

test("the files assemble in the registry's order, each present once", async () => {
  const records = [];
  for (const { slug } of CV_FILES) records.push((await compileCvFile({ slug, raw: read(slug), publications: PUBLICATIONS })).record);
  const missing = assembleCvSource(records.filter((r) => r.slug !== "honors"));
  assert.ok(!missing.ok);
  assert.match(missing.errors.join("\n"), /content\/cv\/honors\.md has no record/);
  const twice = assembleCvSource([...records, records[0]]);
  assert.ok(!twice.ok);
  assert.match(twice.errors.join("\n"), /profile is present twice/);
  const whole = assembleCvSource(records);
  assert.ok(whole.ok);
  assert.equal(whole.source.entries[0].type, "appointment");
  assert.equal(whole.source.entries.at(-1).type, "development");
});
