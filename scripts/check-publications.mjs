/**
 * Gate: the publication corpus is internally consistent and its artifact is fresh.
 *
 *   npm run check:publications
 *
 * ## WHERE THESE ASSERTIONS COME FROM
 *
 * The July build carried 22 of them, and they ran in `pubs-pipeline/verify.py`
 * OUTSIDE this repository. That placement was the defect: a gate that lives
 * beside the network pipeline runs when somebody refreshes the data and never
 * runs on a clone, so the repo shipped a corpus nothing in the repo checked.
 * Hard rule 18's shape, applied to a check rather than to an index. They are
 * here now, reading the committed files, so `npm run check` sees them.
 *
 * The ones that stayed in the pipeline are the ones that need the NETWORK or
 * the PDFs' internals: abstract fidelity against the registry response, DOI
 * extraction provenance, the CSL-against-Crossref comparison. Those cannot be
 * asserted from a clone and are not pretended at here.
 *
 * ## OBSERVATION BOUNDARY
 *
 * Pure. Two committed JSON files, one generated TypeScript module, and `stat`
 * on the PDFs. No network, no database, no build. It CANNOT see whether the
 * registry data is still true, which is `pubs-pipeline/refresh.py`'s job and is
 * a human-initiated refresh rather than a gate, because a gate that fetches
 * Crossref goes red on Crossref's bad day rather than on ours.
 *
 * ## THE PAIRED COUNT, and why it is not decoration
 *
 * Two assertions here are of the form "no record has property X". Both are
 * paired with a count of what was READ, because "0 violations" from a scan that
 * examined nothing looks exactly like a clean sweep. That is the specific trap
 * archive/publications.md records the July build falling into: an early
 * topic-id assertion matched at the wrong indent, swept in all 36 ids, and
 * would have passed with an undeclared topic in the file.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generate } from "./build-publications.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
/** @type {string[]} */
const failures = [];

/**
 * `assertThat(condition, label, detail)`.
 *
 * The argument order is deliberately NOT `check-urls`' `assert(label, ok)` or
 * `check-search`'s `ok(label, condition)`. Three shapes coexist across the
 * gates on purpose, so a call copied from one gate into another is a
 * ReferenceError rather than a silent pass with the label sitting in the
 * condition slot, truthy, incrementing the count. Hard rule 10's "one helper
 * name, one argument order", which `check:invariants` section 17 enforces.
 *
 * @param {boolean} condition
 * @param {string} label
 * @param {string} [detail]
 */
function assertThat(condition, label, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  failures.push(label);
}

/** @param {string} doi */
const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

console.log("check:publications\n");

/* ------------------------------------------------- the sources exist at all */

const SITE_PATH = join(root, "data", "publications.site.json");
const CSL_PATH = join(root, "data", "publications.csl.json");
const OUT_PATH = join(root, "app", "data", "publications.ts");

/*
 * SCOPE FIRST, and it fails CLOSED. Everything below iterates these two files,
 * and every "no record does X" assertion over an empty array passes. Proving
 * the scope is non-empty before reading anything out of it is hard rule 10's
 * first discipline and is the difference between a clean sweep and a sweep that
 * examined nothing.
 */
for (const [label, path] of [
  ["the site file", SITE_PATH],
  ["the CSL file", CSL_PATH],
  ["the generated module", OUT_PATH],
]) {
  if (!existsSync(path)) {
    console.error(`check:publications failed. ${label} is missing: ${path}`);
    process.exit(1);
  }
}

const site = JSON.parse(readFileSync(SITE_PATH, "utf8"));
const csl = JSON.parse(readFileSync(CSL_PATH, "utf8"));
const siteEntries = Object.entries(site);

assertThat(
  siteEntries.length > 0 && Array.isArray(csl) && csl.length > 0,
  "both source files carry records",
  `site ${siteEntries.length}, csl ${Array.isArray(csl) ? csl.length : "not an array"}`,
);
if (siteEntries.length === 0 || !Array.isArray(csl) || csl.length === 0) {
  console.error("\ncheck:publications failed. The scope is empty; nothing below would mean anything.");
  process.exit(1);
}

/* ------------------------------------------------------- the artifact is fresh */

/*
 * The whole of the old `--check` mode, kept as one assertion because that is
 * what it is: a byte comparison between the committed module and a fresh
 * generation. It is listed FIRST among the content assertions because every
 * other one below reads the SOURCES, and this is the only one that can catch a
 * hand-edit of the generated file.
 */
{
  const committed = readFileSync(OUT_PATH, "utf8").replace(/\r\n/g, "\n");
  const emitted = generate();
  let detail = "";
  if (committed !== emitted) {
    const a = committed.split("\n");
    const b = emitted.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        detail =
          `first difference at line ${i + 1}\n` +
          `          committed: ${JSON.stringify(a[i]?.slice(0, 110))}\n` +
          `          generated: ${JSON.stringify(b[i]?.slice(0, 110))}\n` +
          `        It is generated: edit data/publications.*.json and run ` +
          `\`npm run build:publications\`, never app/data/publications.ts.`;
        break;
      }
    }
  }
  assertThat(
    committed === emitted,
    `app/data/publications.ts matches a fresh generation (${emitted.length} bytes)`,
    detail,
  );
}

/* ------------------------------------------------------------------ identity */

const cslByDoi = new Map();
let duplicateCsl = "";
for (const record of csl) {
  const key = doiKey(record.DOI ?? record.id);
  if (cslByDoi.has(key)) duplicateCsl = record.DOI ?? record.id;
  cslByDoi.set(key, record);
}
assertThat(
  duplicateCsl === "",
  `every CSL DOI is distinct after casefolding (${cslByDoi.size} of ${csl.length})`,
  duplicateCsl ? `two records share ${duplicateCsl} once casefolded` : "",
);

const siteKeys = siteEntries.map(([doi]) => doiKey(doi));
assertThat(
  new Set(siteKeys).size === siteKeys.length,
  `every site DOI is distinct after casefolding (${new Set(siteKeys).size} of ${siteKeys.length})`,
  "DOI names are case-insensitive per spec, so two casings of one DOI are one work",
);

assertThat(
  siteEntries.length === csl.length,
  `the two files describe the same number of works (${siteEntries.length})`,
  `site ${siteEntries.length}, csl ${csl.length}`,
);

const unjoined = siteKeys.filter((key) => !cslByDoi.has(key));
assertThat(
  unjoined.length === 0,
  "every site record joins a CSL record",
  unjoined.length ? `no CSL record for: ${unjoined.join(", ")}` : "",
);

const ids = siteEntries.map(([, f]) => f.id);
assertThat(
  new Set(ids).size === ids.length,
  `every record id is unique (${new Set(ids).size} of ${ids.length})`,
);

/* --------------------------------------------------------------- the PDF set */

/*
 * Every hosted path resolves to a real file. This is the assertion that would
 * have caught a rename or a `git rm` of a PDF the data file still advertises,
 * which is a 404 on a link the page renders as though it worked.
 */
const hosted = siteEntries.filter(([, f]) => f.pdfPath);
const missingPdfs = hosted
  .filter(([, f]) => !existsSync(join(root, "public", f.pdfPath.replace(/^\//, ""))))
  .map(([, f]) => f.pdfPath);
assertThat(
  missingPdfs.length === 0,
  `every pdfPath resolves to a file on disk (${hosted.length} hosted)`,
  missingPdfs.length ? `missing: ${missingPdfs.join(", ")}` : "",
);
assertThat(
  hosted.length > 0,
  "the hosted set is non-empty, so the assertion above read something",
  "a zero here would make the missing-PDF sweep vacuous",
);

const emptyPdfs = hosted
  .filter(([, f]) => {
    const p = join(root, "public", f.pdfPath.replace(/^\//, ""));
    return existsSync(p) && statSync(p).size === 0;
  })
  .map(([, f]) => f.pdfPath);
assertThat(
  emptyPdfs.length === 0,
  "no hosted PDF is a zero-byte file",
  emptyPdfs.length ? `empty: ${emptyPdfs.join(", ")}` : "",
);

/*
 * A self-hosted record must carry a path and an external one must not. The
 * `access` field exists so a record can be switched between the two without a
 * schema change, and this is what stops it being switched halfway.
 */
const accessMismatch = siteEntries.filter(
  ([, f]) =>
    (f.access === "self-hosted" && !f.pdfPath) ||
    (f.access === "external" && f.pdfPath),
);
assertThat(
  accessMismatch.length === 0,
  "access agrees with pdfPath on every record",
  accessMismatch.length
    ? accessMismatch.map(([, f]) => `${f.id} is ${f.access} with pdfPath ${f.pdfPath}`).join("; ")
    : "",
);

/* ------------------------------------------------------------- external ids */

/*
 * `pmcUrl` in LANDING-PAGE form. Measured in July against `oa.fcgi`, which of
 * 26 PMCIDs returned 20 ftp tarballs, 2 direct PDFs and 4 not-open-access
 * errors, while the landing page answers 200 for all 26 including the four it
 * refused. The form is the ruling; this is what holds it.
 */
const withPmc = siteEntries.filter(([, f]) => f.pmcUrl);
const badPmcUrls = withPmc
  .filter(([, f]) => !/^https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/$/.test(f.pmcUrl))
  .map(([, f]) => f.pmcUrl);
assertThat(
  badPmcUrls.length === 0,
  `every pmcUrl is in landing-page form (${withPmc.length} carry one)`,
  badPmcUrls.length ? `not landing-page form: ${badPmcUrls.join(", ")}` : "",
);
assertThat(
  withPmc.length > 0,
  "the pmcUrl set is non-empty, so the form assertion above read something",
);

const pmcMismatch = siteEntries.filter(
  ([, f]) => Boolean(f.pmcid) !== Boolean(f.pmcUrl),
);
assertThat(
  pmcMismatch.length === 0,
  "pmcid and pmcUrl are present together or absent together",
  pmcMismatch.length ? pmcMismatch.map(([, f]) => f.id).join(", ") : "",
);

/* ------------------------------------------------------------------ abstracts */

/*
 * NO STORED ABSTRACT CONTAINS `<`, PAIRED WITH THE COUNT THAT READ THEM.
 *
 * The pairing is the assertion. Abstracts arrive as HTML from Europe PMC and as
 * JATS from Crossref, are entity-decoded twice because some are double-encoded,
 * and land in a `<script type="application/ld+json">` block and in a JSON
 * export. An unescaped `<` is the character that ends a script element early.
 *
 * A sweep that found no `<` because it read no abstracts reports exactly what a
 * clean corpus reports, so the count is asserted beside it rather than trusted.
 */
const abstracts = csl.filter((c) => typeof c.abstract === "string" && c.abstract.length > 0);
const withAngle = abstracts.filter((c) => c.abstract.includes("<")).map((c) => c.DOI);
assertThat(
  withAngle.length === 0,
  `no stored abstract contains a left angle bracket (${abstracts.length} read)`,
  withAngle.length ? `contains "<": ${withAngle.join(", ")}` : "",
);
assertThat(
  abstracts.length > 0,
  "the abstract set is non-empty, so the bracket sweep above read something",
  "this is the companion the July build added after an assertion passed by reading zero",
);

/* --------------------------------------------------------------------- topics */

/*
 * Every topic a record claims is declared. Parsed out of the GENERATED module's
 * TOPICS block rather than out of the record list, because the July version of
 * this assertion matched at four-space indent, swept in all 36 publication ids
 * as though they were topic ids, and would have passed with an undeclared topic
 * in the file.
 */
const generated = readFileSync(OUT_PATH, "utf8");
const topicsBlock = /export const TOPICS: Topic\[\] = \[([\s\S]*?)\n\];/.exec(generated);
assertThat(
  Boolean(topicsBlock),
  "the generated module carries a parseable TOPICS block",
  "the block is the only source for declared topic ids; without it the check below is vacuous",
);
const declaredTopics = new Set(
  [...(topicsBlock?.[1] ?? "").matchAll(/^\s{4}id: "([^"]+)",$/gm)].map((m) => m[1]),
);
assertThat(
  declaredTopics.size >= 2,
  `the TOPICS block declares more than one topic (${declaredTopics.size})`,
  "one or zero would mean the parse above matched something other than the block",
);
const undeclared = [
  ...new Set(siteEntries.flatMap(([, f]) => f.topics ?? []).filter((t) => !declaredTopics.has(t))),
];
assertThat(
  undeclared.length === 0,
  `every topic a record claims is declared (${declaredTopics.size} declared)`,
  undeclared.length ? `undeclared: ${undeclared.join(", ")}` : "",
);
const untopiced = siteEntries.filter(([, f]) => !f.topics || f.topics.length === 0);
assertThat(
  untopiced.length === 0,
  "every record carries at least one topic",
  untopiced.length ? untopiced.map(([, f]) => f.id).join(", ") : "",
);

/* -------------------------------------------------------------------- preprint */

/*
 * Exactly one record carries a preprint, and it is the one recorded in July.
 * A COUNT rather than a name, so a second preprint arriving is a decision
 * somebody makes in this file: the bioRxiv record is deliberately NOT merged
 * into the published record, so that every displayed citation figure matches
 * the OpenAlex page a reader would land on, and a second one arriving silently
 * would be a second place that ruling has to hold.
 */
const preprints = siteEntries.filter(([, f]) => f.preprintDoi);
assertThat(
  preprints.length === 1,
  `exactly one record carries a preprintDoi (${preprints.length})`,
  preprints.map(([, f]) => `${f.id} -> ${f.preprintDoi}`).join(", "),
);

/* ----------------------------------------------------------------------- done */

/*
 * EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE on 2026-09-12, never
 * summed from the assertion list above. Slack of two, the convention
 * `check:secrets` records: this gate's count moves only when an assertion is
 * written, so it does not need room to breathe.
 */
const MINIMUM_CHECKS = 20;
const floorBreach = assertFloor("check:publications", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) {
  console.error(`\ncheck:publications failed. ${floorBreach}`);
  process.exit(1);
}

console.log(`\n${checks} checks, ${failures.length} failures`);
if (failures.length > 0) process.exit(1);
