import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import matter from "gray-matter";

import { IDENTITY } from "../app/lib/identity.generated.mjs";
import { deriveIdentity, joinList } from "../app/lib/identity.mjs";
import { IDENTITY_TOKEN_KEYS, expandPageTokens } from "../app/lib/pages/compile.mjs";
import { SITE, personNode } from "../app/lib/seo.ts";
import { CV_PAGE, buildCv } from "../app/lib/cv/entries.mjs";
import { parseCvFile } from "../app/lib/cv/validate.mjs";
import { readIdentity } from "../scripts/lib/identity.mjs";

/* The owner's role, job title and headship are derived from the CV (app/lib/identity.mjs), so a CV change updates
 * the site settings, the titles, the About text, the CV's header and the structured data. These cases show the
 * derivation firing on the rules, and that every surface reads it. */

const PERSON = { name: "Dustin Edwards", degree: "Ph.D.", discipline: "Virologist", department: "Department of Biological Sciences", org: "Tarleton State University, Texas A&M University System" };
const appointment = (/** @type {Record<string, unknown>} */ fields) => ({ type: "appointment", section: "Positions", endYear: "present", ...fields });
const ENTRIES = [
  appointment({ title: "Professor" }),
  appointment({ title: "Associate Professor", endYear: 2025 }),
  appointment({ section: "Administrative and leadership", title: "Department Head", headline: true }),
  appointment({ section: "Administrative and leadership", title: "Chair of a Committee" }),
];

const derive = (/** @type {any} */ person, /** @type {any[]} */ entries) => {
  const result = deriveIdentity(person, entries);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.ok ? result.identity : /** @type {never} */ (null);
};

test("the role is the current rank and the discipline; the headline leadership title joins the job title, others do not", () => {
  const id = derive(PERSON, ENTRIES);
  assert.equal(id.role, "Professor and Virologist");
  assert.equal(id.jobTitle, "Virologist, Professor, and Department Head");
  assert.equal(id.cvTitle, "Professor and Virologist, Department Head");
  assert.equal(id.adminTitle, "Department Head");
  assert.equal(id.affiliation, "Tarleton State University");
  assert.equal(id.departmentSubject, "Biological Sciences");
  assert.equal(id.disciplineLower, "virologist");
});

test("a promotion in the CV changes the role everywhere it is derived", () => {
  const promoted = [...ENTRIES.slice(0, 1).map((e) => ({ ...e, endYear: 2030 })), appointment({ title: "Distinguished Professor" }), ...ENTRIES.slice(1)];
  assert.equal(derive(PERSON, promoted).role, "Distinguished Professor and Virologist");
  const noHead = ENTRIES.filter((e) => e.title !== "Department Head");
  assert.equal(derive(PERSON, noHead).jobTitle, "Virologist and Professor");
  assert.equal(derive(PERSON, noHead).cvTitle, "Professor and Virologist");
});

test("a CV with no current position, two, or an incomplete person cannot give the site a role", () => {
  const none = deriveIdentity(PERSON, ENTRIES.filter((e) => e.title !== "Professor"));
  assert.equal(none.ok, false);
  assert.match(JSON.stringify(none), /0 current positions/);
  const two = deriveIdentity(PERSON, [...ENTRIES, appointment({ title: "Visiting Professor" })]);
  assert.equal(two.ok, false);
  assert.match(JSON.stringify(two), /2 current positions/);
  const noDiscipline = deriveIdentity({ ...PERSON, discipline: "" }, ENTRIES);
  assert.equal(noDiscipline.ok, false);
  assert.match(JSON.stringify(noDiscipline), /person\.discipline is missing/);
});

test("joinList writes one, two and three or more", () => {
  assert.equal(joinList([]), "");
  assert.equal(joinList(["a"]), "a");
  assert.equal(joinList(["a", "b"]), "a and b");
  assert.equal(joinList(["a", "b", "c"]), "a, b, and c");
});

test("the generated module is exactly what the CV files derive, so no copy of the identity goes stale", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(IDENTITY)), JSON.parse(JSON.stringify(readIdentity())));
});

test("the site settings, the person record, the home title source and the CV header all read the derived identity", () => {
  assert.equal(SITE.role, IDENTITY.role);
  assert.equal(SITE.jobTitle, IDENTITY.jobTitle);
  assert.equal(SITE.description.startsWith(`${IDENTITY.role}, ${IDENTITY.department}, ${IDENTITY.affiliation}.`), true);
  const person = personNode("https://example.test");
  assert.equal(person.jobTitle, IDENTITY.jobTitle);
  assert.equal(person.honorificSuffix, IDENTITY.degree);
  assert.match(CV_PAGE.seoTitle, new RegExp(IDENTITY.role));
  assert.match(CV_PAGE.description, new RegExp(IDENTITY.affiliation));
  const cv = buildCv(
    { edition: "Fall 2026", person: PERSON, presentations: { international: 1, national: 1, from: 2004, to: 2026 }, entries: ENTRIES },
    [],
  );
  assert.equal(cv.person.title, "Professor and Virologist, Department Head", "the CV header names the headship");
  assert.equal(cv.person.discipline, "Virologist");
});

test("page tokens read the identity, refuse an unknown fact, and leave other text alone", () => {
  const ok = expandPageTokens("{{identity.name}} is {{identity.adminTitle}} of {{identity.departmentSubject}} at {{identity.affiliation}}", undefined);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.text, `${IDENTITY.name} is ${IDENTITY.adminTitle} of ${IDENTITY.departmentSubject} at ${IDENTITY.affiliation}`);
  const bad = expandPageTokens("{{identity.shoeSize}}", undefined);
  assert.equal(bad.ok, false);
  assert.match(JSON.stringify(bad), /not an identity fact/);
  assert.deepEqual(expandPageTokens("plain", undefined), { ok: true, text: "plain" });
  for (const key of IDENTITY_TOKEN_KEYS) assert.equal(typeof (/** @type {any} */ (IDENTITY))[key], "string", `${key} is a text fact of the identity`);
});

test("no page types the headship or the role: each is a token, so a CV change updates every page", () => {
  const dir = new URL("../content/pages/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".md"))) {
    const raw = readFileSync(new URL(file, dir), "utf8");
    const { data, content } = matter(raw, {});
    const text = `${JSON.stringify(data)}\n${content}`;
    assert.doesNotMatch(text, new RegExp(IDENTITY.adminTitle), `${file} types "${IDENTITY.adminTitle}"; use {{identity.adminTitle}}`);
    assert.doesNotMatch(text, new RegExp(IDENTITY.role), `${file} types "${IDENTITY.role}"; use {{identity.role}}`);
  }
});

test("the profile states no title and the validator says why", () => {
  const raw = readFileSync(new URL("../content/cv/profile.md", import.meta.url), "utf8");
  const file = { slug: "profile", type: /** @type {const} */ ("profile") };
  assert.equal(parseCvFile(file, raw).ok, true, "the committed profile is accepted");
  const withTitle = raw.replace("discipline: Virologist", "title: Professor and Virologist");
  assert.notEqual(withTitle, raw);
  const result = parseCvFile(file, withTitle);
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result), /derived from the current appointment/);
});

test("a headline marker is a boolean on an appointment, and nowhere else", () => {
  const raw = readFileSync(new URL("../content/cv/appointments.md", import.meta.url), "utf8");
  const file = { slug: "appointments", type: /** @type {const} */ ("appointment") };
  assert.equal(parseCvFile(file, raw).ok, true);
  const text = parseCvFile(file, raw.replace("headline: true", "headline: yes please"));
  assert.equal(text.ok, false);
});
