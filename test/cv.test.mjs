import test from "node:test";
import assert from "node:assert/strict";

import { buildCvFrom } from "../scripts/lib/cv.mjs";
import { buildPublications } from "../scripts/lib/publications.mjs";
import { renderCvCharts } from "../app/lib/cv/render-charts.ts";
import { cvFacts } from "../app/lib/cv/entries.mjs";
import { cvMarkdownDocument } from "../app/lib/cv/markdown.mjs";
import {
  AREAS,
  ROLES,
  TYPES,
  matches,
  parseState,
  stateToSearch,
  timelineData,
} from "../app/lib/cv/view.mjs";
import { cvFingerprint } from "../app/lib/cv/pdf-html.mjs";

// The CV as the build resolves it: the files in content/cv/ joined to the records in content/publications/. The
// build compiles every file with the validation module the CV save uses (app/lib/cv/validate.mjs), so a file that
// breaks a rule never gets this far; test/cv-validate.test.mjs shows each rule firing.
const PUBLICATIONS = (await buildPublications()).records;
const BUILT = await buildCvFrom(PUBLICATIONS);
const CV = BUILT.cv;
const FACTS = cvFacts(CV.entries);
/** What the files state, entry by entry, in the CV's order. */
const SOURCE = BUILT.rows.flatMap((row) => JSON.parse(row.record).entries ?? []);

await test("a paper named by DOI takes its facts from the site's Crossref-backed record, and its role from the author list", () => {
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

await test("the URL state round-trips, drops what it does not know and orders a reversed range", () => {
  const state = parseState(
    new URLSearchParams(
      "type=grant&type=publication&area=bacteriophages&from=2015&to=2020&role=senior-author&q=phage&sort=newest",
    ),
  );
  assert.deepEqual(state.types, ["grant", "publication"]);
  const search = stateToSearch(state);
  assert.equal(
    search,
    "?type=publication&type=grant&area=bacteriophages&from=2015&to=2020&role=senior-author&q=phage&sort=newest",
  );
  assert.equal(stateToSearch(parseState(new URLSearchParams(search.slice(1)))), search);
  assert.deepEqual(parseState(new URLSearchParams("type=publication,talk")).types, [
    "publication",
    "talk",
  ]);
  const junk = parseState(new URLSearchParams("type=nope&area=x&role=boss&sort=up&from=19"));
  assert.equal(stateToSearch(junk), "");
  const reversed = parseState(new URLSearchParams("from=2020&to=2010"));
  assert.equal(reversed.from, 2010);
  assert.equal(reversed.to, 2020);
});

/** The timeline as the route draws it: the empty-data guard in render-charts.ts is the only thing between a filter and Enarratio. */
const timelineFor = (query) => {
  const state = parseState(new URLSearchParams(query));
  const data = timelineData(FACTS, state);
  return { data, markup: renderCvCharts(FACTS, state).timeline };
};

await test("no combination of the CV's filters throws, and the sentence appears exactly when no charted entry is selected", () => {
  const queries = [""];
  const ids = (table) => table.map(([id]) => id);
  for (const t of ids(TYPES)) queries.push(`type=${t}`);
  for (const r of ids(ROLES)) queries.push(`role=${r}`);
  for (const a of ids(AREAS)) queries.push(`area=${a}`);
  for (const t of ids(TYPES)) for (const r of ids(ROLES)) queries.push(`type=${t}&role=${r}`);
  for (const t of ids(TYPES)) for (const a of ids(AREAS)) queries.push(`type=${t}&area=${a}`);
  for (const r of ids(ROLES)) for (const a of ids(AREAS)) queries.push(`role=${r}&area=${a}`);
  queries.push(
    "q=zzzznomatch",
    "from=2099",
    "to=1900",
    "from=2099&type=publication",
    "type=grant&role=senior-author&q=x",
  );
  const charted = new Set(["publication", "grant", "talk", "award"]);
  let empties = 0;
  for (const query of queries) {
    const { data, markup } = timelineFor(query); // a throw here is the 500
    const state = parseState(new URLSearchParams(query));
    const chartable = FACTS.some(
      (f) => matches(f, state, { ignoreYears: true }) && charted.has(f.type) && f.year !== null,
    );
    assert.equal(markup.includes('data-state="nodata"'), !chartable, `?${query}`);
    if (!chartable) empties += 1;
    assert.equal(
      data.entries,
      FACTS.filter((f) => matches(f, state, { ignoreYears: true })).length,
      `?${query}`,
    );
  }
  assert.ok(empties > 20, "the table reaches the empty states");
});

await test("the twin cites every paper by DOI and keeps mentoring as counts", () => {
  const doc = cvMarkdownDocument(CV);
  for (const e of CV.entries) {
    if (e.paper?.doi) assert.ok(doc.includes(`https://doi.org/${e.paper.doi}`), e.paper.doi);
  }
  assert.match(doc, /^---\npath: \/cv\n/);
  assert.match(doc, /Shown as counts; the CV names each student\./);
});

// The PDF is no longer a committed file this test could read back: the Worker renders it after each CV save and
// stores it with the fingerprint of the data it was drawn from (app/lib/cv/pdf.server.ts), and the cv-pdf-drift check
// compares that fingerprint with D1's. What can be pinned offline is the fingerprint itself and the document it stamps.
await test("the PDF's fingerprint is a deterministic function of the CV data, and moves with it", async () => {
  const fingerprint = await cvFingerprint(CV);
  assert.match(fingerprint, /^[0-9a-f]{8}$/);
  assert.equal(await cvFingerprint(CV), fingerprint, "the same data, the same fingerprint");
  assert.equal(
    await cvFingerprint(structuredClone(CV)),
    fingerprint,
    "a copy of the data, the same fingerprint",
  );
  assert.notEqual(
    await cvFingerprint({ ...CV, edition: `${CV.edition} (revised)` }),
    fingerprint,
    "an edition change moves it",
  );
  const [first, ...rest] = CV.entries;
  assert.ok(first, "the CV has entries");
  assert.notEqual(
    await cvFingerprint({ ...CV, entries: rest }),
    fingerprint,
    "a dropped entry moves it",
  );
});
