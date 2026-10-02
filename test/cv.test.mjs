import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractText, getDocumentProxy } from "unpdf";

import { buildCvFrom } from "../scripts/lib/cv.mjs";
import { buildPublications } from "../scripts/lib/publications.mjs";
import { timelineSvg } from "../app/lib/cv/charts.ts";
import { cvFacts } from "../app/lib/cv/entries.mjs";
import { cvMarkdownDocument } from "../app/lib/cv/markdown.mjs";
import {
  AREAS,
  ROLES,
  TYPES,
  chartYears,
  facetCounts,
  groupEntries,
  headline,
  matches,
  parseState,
  stateToSearch,
  timelineData,
  timelineEmptyText,
} from "../app/lib/cv/view.mjs";
import { CHART_CSS_PATH, chartCss } from "../scripts/build-chart-css.mjs";
import { CV_PDF_DISK_PATH, FINGERPRINT_LABEL, cvFingerprint } from "../scripts/build-cv-pdf.mjs";

// The CV as the build resolves it: the files in content/cv/ joined to the records in content/publications/. The
// build compiles every file with the validation module the CV save uses (app/lib/cv/validate.mjs), so a file that
// breaks a rule never gets this far; test/cv-validate.test.mjs shows each rule firing.
const PUBLICATIONS = (await buildPublications()).records;
const BUILT = await buildCvFrom(PUBLICATIONS);
const CV = BUILT.cv;
const FACTS = cvFacts(CV.entries);
/** What the files state, entry by entry, in the CV's order. */
const SOURCE = BUILT.rows.flatMap((row) => JSON.parse(row.record).entries ?? []);

test("every entry resolves, with a known type, known areas, a known role and a unique id", () => {
  const types = new Set(TYPES.map(([id]) => id));
  const areas = new Set(AREAS.map(([id]) => id));
  const roles = new Set(ROLES.map(([id]) => id));
  assert.equal(CV.entries.length, SOURCE.length);
  for (const e of CV.entries) {
    assert.ok(types.has(e.type), `${e.id}: type ${e.type}`);
    for (const a of e.areas) assert.ok(areas.has(a), `${e.id}: area ${a}`);
    if (e.role) assert.ok(roles.has(e.role), `${e.id}: role ${e.role}`);
  }
  assert.equal(new Set(CV.entries.map((e) => e.id)).size, CV.entries.length);
});

test("a paper named by DOI takes its facts from the site's Crossref-backed record, and its role from the author list", () => {
  const byDoi = new Map(PUBLICATIONS.flatMap((p) => (p.doi ? [[p.doi.toLowerCase(), p]] : [])));
  const refs = SOURCE.filter((e) => e.type === "publication" && "doi" in e);
  assert.ok(refs.length >= 30, `${refs.length} papers by DOI`);
  for (const ref of refs) {
    const record = byDoi.get(ref.doi.toLowerCase());
    assert.ok(record, ref.doi);
    const entry = CV.entries.find((e) => e.paper?.doi === record.doi);
    assert.ok(entry, record.doi);
    assert.equal(entry.year, record.year);
    assert.equal(entry.paper.authors.length, record.authors.length);
  }
  const godfather = CV.entries.find((e) => e.paper?.doi === "10.1128/mra.00888-24");
  assert.equal(godfather?.role, "senior-author");
  const tax = CV.entries.find((e) => e.paper?.doi === "10.1128/jvi.00356-08");
  assert.equal(tax?.role, "first-author");
});

test("privacy: mentoring is counts, and no line in the CV data carries an email, a phone or a room", () => {
  const MENTORING_KEYS = new Set([
    "type", "section", "year", "endYear", "count", "unit", "level", "program", "org", "detail", "cohort", "areas", "role", "links",
  ]);
  for (const e of SOURCE.filter((x) => x.type === "mentoring")) {
    for (const key of Object.keys(e)) assert.ok(MENTORING_KEYS.has(key), `mentoring entry carries "${key}"`);
    assert.equal(typeof e.count, "number");
  }
  // The values, not the file: its header comment names what it leaves out.
  const data = JSON.stringify(SOURCE);
  assert.doesNotMatch(data, /@[a-z0-9-]+\.[a-z]{2,}/i, "an email address");
  assert.doesNotMatch(data, /\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/, "a phone number");
  assert.doesNotMatch(data, /\bRoom\b|\bSuite\b|\bOffice \d/i, "a room");
  assert.doesNotMatch(data, /Mountains Lake/i, "a private community group");
});

test("the URL state round-trips, drops what it does not know and orders a reversed range", () => {
  const state = parseState(
    new URLSearchParams("type=grant&type=publication&area=bacteriophages&from=2015&to=2020&role=senior-author&q=phage&sort=newest"),
  );
  assert.deepEqual(state.types, ["grant", "publication"]);
  const search = stateToSearch(state);
  assert.equal(search, "?type=publication&type=grant&area=bacteriophages&from=2015&to=2020&role=senior-author&q=phage&sort=newest");
  assert.equal(stateToSearch(parseState(new URLSearchParams(search.slice(1)))), search);
  assert.deepEqual(parseState(new URLSearchParams("type=publication,talk")).types, ["publication", "talk"]);
  const junk = parseState(new URLSearchParams("type=nope&area=x&role=boss&sort=up&from=19"));
  assert.equal(stateToSearch(junk), "");
  const reversed = parseState(new URLSearchParams("from=2020&to=2010"));
  assert.equal(reversed.from, 2010);
  assert.equal(reversed.to, 2020);
});

test("filters combine: type and area and years and role and search", () => {
  const count = (/** @type {string} */ query) =>
    FACTS.filter((f) => matches(f, parseState(new URLSearchParams(query)))).length;
  assert.equal(count(""), CV.entries.length);
  assert.equal(count("type=publication"), 34);
  assert.equal(count("type=grant"), 43);
  assert.ok(count("type=publication&area=bacteriophages") > 0);
  assert.equal(count("type=publication&from=2019&to=2019"), 3);
  const seniorPhage = count("type=publication&area=bacteriophages&role=senior-author");
  assert.ok(seniorPhage > 0 && seniorPhage < count("type=publication&area=bacteriophages"));
  // An ongoing appointment matches a range after it began; an undated membership matches no range.
  const professor = FACTS.find((f) => f.type === "appointment" && f.endYear === "present");
  assert.ok(professor && matches(professor, parseState(new URLSearchParams("from=2030"))));
  const membership = FACTS.find((f) => f.year === null);
  assert.ok(membership && !matches(membership, parseState(new URLSearchParams("to=2030"))));
  // Search folds case and accents, and every word must match.
  assert.ok(count("q=GALVAO") > 0);
  assert.equal(count("q=phage+zzzz"), 0);
});

test("the counts, the facets and the grouping agree with the entries", () => {
  const all = headline(FACTS);
  assert.equal(all.papers, 34);
  assert.equal(all.grants, 43);
  assert.equal(
    all.students,
    SOURCE.reduce((n, e) => n + (e.type === "mentoring" && e.unit === "students" ? e.count : 0), 0),
  );
  const facets = facetCounts(FACTS, parseState(new URLSearchParams("type=publication")));
  assert.equal(facets.types.grant, 43, "a type's count ignores the type filter");
  assert.deepEqual(
    groupEntries(FACTS, "type").map((g) => g.key),
    TYPES.map(([id]) => `type-${id}`),
  );
  const byYear = groupEntries(FACTS, "newest");
  assert.equal(byYear[byYear.length - 1]?.heading, "Undated");
  const ids = byYear.flatMap((g) => g.parts.flatMap((p) => p.ids));
  assert.equal(new Set(ids).size, CV.entries.length);
});

test("the timeline counts each charted type by year", () => {
  const state = parseState(new URLSearchParams(""));
  const data = timelineData(FACTS, state);
  assert.deepEqual(data.years, chartYears(FACTS));
  const pubs = data.series.find((s) => s.key === "publication");
  assert.equal(pubs?.values.reduce((a, b) => a + b, 0), 34);
});

test("a range filter fades exactly the timeline's bars outside it", () => {
  const years = [2019, 2020, 2021, 2022, 2023];
  const markup = timelineSvg({
    years,
    series: [{ key: "publication", label: "Publications", token: "var(--brand)", values: [1, 1, 1, 1, 1] }],
    selected: [2020, 2021],
    label: "Output per year",
    hrefForYear: (year) => `/cv?from=${year}&to=${year}`,
  });
  const bars = [...markup.matchAll(/<a [^>]*data-enarratio-key=[^>]*>/g)].map((m) => m[0]);
  assert.equal(bars.length, years.length, "one bar per year");
  const faded = bars.filter((bar) => bar.includes('data-cv-out=""'));
  const fadedYears = faded.map((bar) => bar.match(/data-enarratio-x="(\d{4})"/)?.[1]).sort();
  assert.deepEqual(fadedYears, ["2019", "2022", "2023"]);
});

/** The timeline as the route draws it: the empty-data guard in charts.ts is the only thing between a filter and Enarratio. */
const timelineFor = (query) => {
  const data = timelineData(FACTS, parseState(new URLSearchParams(query)));
  const markup = timelineSvg({
    years: data.years,
    series: data.series,
    selected: data.selected,
    label: "Output per year",
    emptyText: timelineEmptyText(data),
    hrefForYear: (year) => `/cv?from=${year}&to=${year}`,
  });
  return { data, markup };
};

test("a filter that selects nothing chartable gets a sentence, never an Enarratio call with empty data", () => {
  // The case from the report: grants as senior author selects no entry at all.
  const none = timelineFor("type=grant&role=senior-author");
  assert.equal(none.data.entries, 0);
  assert.equal(
    none.markup,
    '<p class="cv-timeline-hint" data-cv-timeline-empty="">No entries match these filters, so there is nothing to chart.</p>',
  );
  // Entries match, but none is a charted type: courses and service are the CV's largest examples.
  const uncharted = timelineFor("type=service");
  assert.ok(uncharted.data.entries > 0);
  assert.match(uncharted.markup, /data-cv-timeline-empty/);
  assert.match(uncharted.markup, /publications, grants, invited talks and awards, and none of the entries/);
  // The innocent cases: anything with a charted entry is still a figure, with no sentence.
  for (const query of ["", "type=publication", "type=grant&from=2018&to=2022", "role=first-author&sort=newest", "area=bacteriophages&type=talk"]) {
    const { markup } = timelineFor(query);
    assert.ok(markup.includes("<svg"), `${query || "no filter"} draws the chart`);
    assert.ok(!markup.includes("data-cv-timeline-empty"), `${query || "no filter"} has no empty sentence`);
  }
});

test("no combination of the CV's filters throws, and the sentence appears exactly when no charted entry is selected", () => {
  const queries = [""];
  const ids = (table) => table.map(([id]) => id);
  for (const t of ids(TYPES)) queries.push(`type=${t}`);
  for (const r of ids(ROLES)) queries.push(`role=${r}`);
  for (const a of ids(AREAS)) queries.push(`area=${a}`);
  for (const t of ids(TYPES)) for (const r of ids(ROLES)) queries.push(`type=${t}&role=${r}`);
  for (const t of ids(TYPES)) for (const a of ids(AREAS)) queries.push(`type=${t}&area=${a}`);
  for (const r of ids(ROLES)) for (const a of ids(AREAS)) queries.push(`role=${r}&area=${a}`);
  queries.push("q=zzzznomatch", "from=2099", "to=1900", "from=2099&type=publication", "type=grant&role=senior-author&q=x");
  const charted = new Set(["publication", "grant", "talk", "award"]);
  let empties = 0;
  for (const query of queries) {
    const { data, markup } = timelineFor(query); // a throw here is the 500
    const state = parseState(new URLSearchParams(query));
    const chartable = FACTS.some((f) => matches(f, state, { ignoreYears: true }) && charted.has(f.type) && f.year !== null);
    assert.equal(markup.includes("data-cv-timeline-empty"), !chartable, `?${query}`);
    if (!chartable) empties += 1;
    assert.equal(data.entries, FACTS.filter((f) => matches(f, state, { ignoreYears: true })).length, `?${query}`);
  }
  assert.ok(empties > 20, "the table reaches the empty states");
});

test("a value outside the vocabulary is dropped, so it never narrows to nothing", () => {
  assert.deepEqual(parseState(new URLSearchParams("type=bogus&role=bogus&area=bogus")), parseState(new URLSearchParams("")));
});

test("the twin cites every paper by DOI and keeps mentoring as counts", () => {
  const doc = cvMarkdownDocument(CV);
  for (const e of CV.entries) {
    if (e.paper?.doi) assert.ok(doc.includes(`https://doi.org/${e.paper.doi}`), e.paper.doi);
  }
  assert.match(doc, /^---\npath: \/cv\n/);
  assert.match(doc, /Shown as counts; the CV names each student\./);
});

test("the committed PDF was rendered from the current CV (npm run build:cv-pdf)", async () => {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(CV_PDF_DISK_PATH)));
  const { text } = await extractText(pdf, { mergePages: true });
  const flat = String(text).replace(/\s+/g, " ");
  assert.ok(
    flat.includes(`${FINGERPRINT_LABEL} ${cvFingerprint(CV)}`),
    `the PDF does not carry "${FINGERPRINT_LABEL} ${cvFingerprint(CV)}": the CV changed since it was rendered. ` +
      "Run npm run build:cv-pdf, then build:assets and build:template-refs.",
  );
});

test("the committed chart stylesheet is Enarratio's current output (npm run build:chart-css)", () => {
  assert.equal(readFileSync(CHART_CSS_PATH, "utf8"), chartCss());
});
