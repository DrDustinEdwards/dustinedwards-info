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
import { doiSlug, paperPath, paperPdfPath } from "../app/lib/publications/paths.mjs";
import {
  buildCitationTags,
  REQUIRED_CITATION_TAGS,
} from "../app/lib/publications/citation-tags.mjs";
import { PUBLICATIONS } from "../app/data/publications.ts";
import { SHOWCASE_TYPES } from "../app/lib/publications/export-response.mjs";
import {
  organismsIn,
  toBibtex,
  toBibtexAll,
  toCslJson,
  toRisAll,
} from "../app/lib/publications/exports.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
/** @type {string[]} */
const failures = [];

/**
 * `assertThat(ok, label, detail)`, the condition FIRST.
 *
 * ## THE PARAMETER IS NAMED `ok` BECAUSE FIVE OTHER GATES NAME IT `ok`
 *
 * Three reporter shapes coexist across the gates on purpose, so a call copied
 * from one gate into another is a ReferenceError rather than a silent pass with
 * the label sitting in the condition slot, truthy, incrementing the count:
 * `assert(label, ok)` in check-urls, `ok(label, condition)` in check-search,
 * and `assertThat(ok, label)` here and in five others.
 *
 * This was written as `assertThat(condition, ...)`, which is the SAME ORDER and
 * still failed `check:invariants` section 17, correctly. That gate compares the
 * first parameter's NAME across every definition of a given helper name,
 * because a name is all a static scan can compare: it cannot know that
 * `condition` and `ok` mean the same thing, and the day they do not mean the
 * same thing is the day the gate has to be able to say so. Two spellings of one
 * helper is the drift it refuses, whether or not this instance was harmless.
 *
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
function assertThat(ok, label, detail = "") {
  checks += 1;
  if (ok) {
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

/* ----------------------------------------------------- slugs, pages and PDFs */

/*
 * THE SLUG IS LOSSY AND THIS IS WHERE THAT IS MADE SAFE.
 *
 * `doiSlug` collapses every run of non-alphanumerics to one hyphen, so
 * `10.1234/ab-cd` and `10.1234/ab.cd` produce the same slug. No such pair is in
 * this corpus. A collision would mean two papers sharing a URL, one of them
 * unreachable, and the unreachable one would still be in the sitemap.
 */
const slugs = siteEntries.map(([doi]) => doiSlug(doi));
const slugCounts = new Map();
for (const slug of slugs) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
const collided = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
assertThat(
  collided.length === 0,
  `every DOI produces a distinct page slug (${slugCounts.size} of ${slugs.length})`,
  collided.length
    ? `these slugs are claimed by more than one DOI: ${collided.join(", ")}. ` +
        "doiSlug collapses punctuation, so two DOIs differing only in punctuation collide."
    : "",
);
assertThat(
  slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
  "every slug is a single lower-case path segment",
  slugs.filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)).join(", "),
);

/*
 * THE PDF SITS WHERE THE PAGE CLAIMS IT DOES, AND `paperPdfPath` IS THE OWNER.
 *
 * `pdfPath` stays a LITERAL in the data file rather than being derived at
 * render time, for one measured reason: `build:template-refs` matches asset
 * references as literal strings in source, and a path built from a template
 * would make all 31 PDFs read as unreferenced next to a delete button in the
 * media library. So the literal is kept for the scanner and this assertion
 * binds it to the one function that owns the rule.
 *
 * Without this, the two could drift and the symptom would be the quiet one:
 * `citation_pdf_url` pointing into a directory that is not the page's, which
 * Scholar declines silently and which takes six to nine months to correct.
 */
const pathMismatch = siteEntries
  .filter(([doi, f]) => f.pdfPath && f.pdfPath !== paperPdfPath(doiSlug(doi)))
  .map(([doi, f]) => `${f.id}: ${f.pdfPath} should be ${paperPdfPath(doiSlug(doi))}`);
assertThat(
  pathMismatch.length === 0,
  `every hosted pdfPath is the path paperPdfPath derives (${hosted.length} checked)`,
  pathMismatch.join("; "),
);

/*
 * EVERY PDF IS INSIDE ITS OWN PAPER'S DIRECTORY. Stated separately from the
 * equality above because it is the PROPERTY Scholar cares about, and the
 * equality is only the mechanism that currently delivers it. If
 * `paperPdfPath` were ever changed to put files somewhere else, the assertion
 * above would still pass and this one would not.
 */
const outsideOwnDirectory = siteEntries
  .filter(([doi, f]) => f.pdfPath && !f.pdfPath.startsWith(`/publications/${doiSlug(doi)}/`))
  .map(([, f]) => f.id);
assertThat(
  outsideOwnDirectory.length === 0,
  "every hosted PDF is in the same subdirectory as its paper's page",
  outsideOwnDirectory.length
    ? `${outsideOwnDirectory.join(", ")}. Google Scholar only honours ` +
        "citation_pdf_url when the file is in the abstract page's own subdirectory."
    : "",
);

/* ------------------------------------------------------- the redirect map */

/*
 * BOTH DIRECTIONS. Every moved PDF has a redirect from its old URL, and every
 * redirect names a PDF that exists. A one-way check would pass on a map that
 * had grown an entry pointing at nothing, which is a 301 into a 404.
 */
const redirects = JSON.parse(readFileSync(join(root, "content", "redirects.json"), "utf8"));
const pdfRedirects = redirects.pdfs ?? {};
const redirectTargets = new Set(Object.values(pdfRedirects));
const hostedPaths = new Set(hosted.map(([, f]) => f.pdfPath));

assertThat(
  Object.keys(pdfRedirects).length > 0,
  `the PDF redirect map is populated (${Object.keys(pdfRedirects).length} entries)`,
  "an empty map would make both directions below vacuous",
);
const unredirected = [...hostedPaths].filter((p) => !redirectTargets.has(p));
assertThat(
  unredirected.length === 0,
  `every hosted PDF is the target of a redirect from its old URL (${hostedPaths.size} hosted)`,
  unredirected.length
    ? `no old URL redirects to: ${unredirected.join(", ")}. Every one of these ` +
        "was published at a flat path for seven weeks and that URL is a promise."
    : "",
);
const danglingTargets = [...redirectTargets].filter((p) => !hostedPaths.has(p));
assertThat(
  danglingTargets.length === 0,
  "every redirect target is a PDF the corpus actually hosts",
  danglingTargets.length ? `301 into nothing: ${danglingTargets.join(", ")}` : "",
);
const sourcesStillOnDisk = Object.keys(pdfRedirects).filter((p) =>
  existsSync(join(root, "public", p.replace(/^\//, ""))),
);
assertThat(
  sourcesStillOnDisk.length === 0,
  "no redirect source is also a file on disk",
  sourcesStillOnDisk.length
    ? `${sourcesStillOnDisk.join(", ")} exist as assets, and the static handler runs ` +
        "ahead of the Worker, so the redirect would never fire."
    : "",
);

/* ------------------------------------------------------------------ rights */

/*
 * WHICH PDFs MAY BE HOSTED, AND WHY THIS IS AN ALLOWLIST RATHER THAN A RULE.
 *
 * Ruling 63 and Grok's review said: host and tag only papers whose licence
 * permits redistribution, and link the rest. Dustin ruled otherwise on
 * 2026-09-12, after being shown which four were closed and which registries
 * said so: ALL 31 STAY UP. That is his call on his own work and this gate does
 * not relitigate it.
 *
 * What a gate can still do is make sure the decision stays DELIBERATE. So the
 * records hosted WITHOUT a redistribution licence are named here, individually,
 * with the licence state measured at the time of the ruling. A new hosted PDF
 * that has no licence and is not on this list is a NEW instance of a decision
 * somebody made once, and it reds naming the DOI.
 *
 * The list is therefore not "these are fine". It is "these were looked at".
 *
 * ## THE THREE STATES, WHICH IS WHY `licenseSource` EXISTS
 *
 *   a licence          the record carries redistribution terms
 *   crossref:tdm-only  terms WERE deposited and they are text-mining terms,
 *                      which licence redistribution to nobody
 *   null               neither registry recorded any terms
 *
 * Collapsing the middle into the last would hide that those five were checked
 * and found wanting, which is exactly the distinction a future reader needs.
 */
const HOSTED_WITHOUT_LICENCE = new Map([
  // Open access per Unpaywall, no licence recorded. Four ASM papers: one green,
  // three bronze. Bronze means free to read on the publisher's site with no
  // licence at all, which is a decision the publisher can reverse.
  ["10.1128/jvi.00356-08", "ASM, green OA, crossref:tdm-only"],
  ["10.1128/jvi.01788-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.03444-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.02150-14", "ASM, bronze OA, crossref:tdm-only"],
  // Not open access at all. These are the four ruling 63 asked to stop hosting.
  ["10.1002/9780470025079.chap06.pub2", "Wiley chapter, closed, crossref:tdm-only"],
  ["10.1080/07448481.2025.2472184", "Taylor and Francis, closed"],
  ["10.7589/2018-08-187", "Journal of Wildlife Diseases, closed"],
  ["10.7589/2019-04-088", "Journal of Wildlife Diseases, closed since July"],
  ["10.7589/JWD-D-22-00023", "Journal of Wildlife Diseases, closed"],
]);

{
  /** A licence that permits redistribution, by the shape the registries return. */
  const permitsRedistribution = (/** @type {string | null} */ licence) =>
    typeof licence === "string" &&
    (licence.startsWith("cc-by") || licence === "cc0" || licence === "public-domain");

  const hostedRecords = siteEntries.filter(([, f]) => f.pdfPath);
  const licensed = hostedRecords.filter(([, f]) => permitsRedistribution(f.license));
  const unlicensed = hostedRecords.filter(([, f]) => !permitsRedistribution(f.license));

  console.log(
    `        (${licensed.length} hosted with a redistribution licence, ` +
      `${unlicensed.length} hosted without one and named below)`,
  );

  assertThat(
    hostedRecords.length > 0,
    `the hosted set is non-empty (${hostedRecords.length})`,
    "every rights assertion below iterates it",
  );
  assertThat(
    licensed.length > 0,
    `some hosted PDFs carry a redistribution licence (${licensed.length})`,
    "a zero would mean the licence predicate matches nothing and the split below is fake",
  );

  const undeclared = unlicensed.filter(([doi]) => !HOSTED_WITHOUT_LICENCE.has(doi));
  assertThat(
    undeclared.length === 0,
    `every PDF hosted without a licence is named in this gate (${unlicensed.length})`,
    undeclared.length
      ? undeclared
          .map(([doi, f]) => `${f.id} (${doi}), licence ${f.license ?? "none"}, ` +
            `source ${f.licenseSource ?? "none"}`)
          .join("; ") +
          ". Hosting a paper whose licence does not permit it is Dustin's call to " +
          "make and is recorded per DOI, so a NEW one is a new decision rather " +
          "than a precedent."
      : "",
  );

  /*
   * THE OTHER DIRECTION. A DOI on the list that is no longer hosted without a
   * licence means either the file went away or the registry now records terms,
   * and both make the entry a stale note about a decision nobody is taking any
   * more. Stale exemptions are how an allowlist stops meaning anything.
   */
  const stale = [...HOSTED_WITHOUT_LICENCE.keys()].filter(
    (doi) => !unlicensed.some(([d]) => d === doi),
  );
  assertThat(
    stale.length === 0,
    "every DOI named here is still a PDF hosted without a licence",
    stale.length
      ? `${stale.join(", ")}. Either the file is gone or a registry now records ` +
          "terms; check which, then remove the entry."
      : "",
  );

  /*
   * `licenseSource` IS RECORDED FOR EVERY HOSTED RECORD, including the ones with
   * no licence. A null source on an unlicensed record would mean nobody has
   * looked, and that is the state this whole block exists to make impossible.
   */
  const unchecked = unlicensed.filter(([, f]) => !f.licenseSource && f.license === null);
  assertThat(
    unchecked.length === 0,
    `every unlicensed hosted record records what the registries said (${unlicensed.length})`,
    unchecked.length
      ? `${unchecked.map(([, f]) => f.id).join(", ")} carry neither a licence nor a ` +
          "licenseSource, so it is not possible to tell a closed paper from an " +
          "unchecked one. Re-run pubs-pipeline/refresh.py."
      : "",
  );
}

/* --------------------------------------------------- the Highwire tag set */

/*
 * THE CITATION TAGS, PER RECORD, THROUGH THE BUILDER THE ROUTE CALLS.
 *
 * ## WHY NOT AGAINST RENDERED MARKUP
 *
 * The obvious check is to render the page and read its `<head>`. It cannot be
 * done offline here: `scripts/lib/route-render.mjs` renders a route's COMPONENT
 * through `createRoutesStub`, and React Router's `meta()` output is assembled by
 * `<Meta />` in the root layout, which that stub does not mount. So a render
 * would return a page with no meta tags at all and an assertion over it would
 * pass by finding nothing, which is the vacuity this repo gates against
 * everywhere else.
 *
 * So this is a two-part check and both parts are needed. The BUILDER is
 * exercised over every record, and the ROUTE is asserted to call it, comments
 * stripped. Either half alone is a gate that can be satisfied while the page is
 * wrong: a correct builder nobody calls, or a call to a builder that emits
 * nothing.
 *
 * The wire itself belongs to `check:browser`, which drives a real preview and
 * is on the network tier. That is the one place the actual head can be read,
 * and it is named here so the boundary is recorded rather than implied.
 *
 * ## THE THREE THAT ARE HARD FAILURES
 *
 * Google Scholar's guidelines name the minimum: the title, the full name of at
 * least the first author, and the year. A page missing any of them is not
 * indexed badly, it is not indexed. `buildCitationTags` THROWS rather than
 * emitting a partial set, so this block catches the throw and reports it as the
 * record's failure rather than taking the gate down.
 */
{
  const ORIGIN = "https://example.invalid";
  /** @type {string[]} */
  const tagFailures = [];
  let tagged = 0;
  let authorTags = 0;
  let pdfTags = 0;

  for (const paper of PUBLICATIONS) {
    const slug = doiSlug(paper.doi);
    const hosted = paper.access === "self-hosted" && paper.pdfPath !== null;
    let tags;
    try {
      tags = buildCitationTags(paper, {
        abstractUrl: `${ORIGIN}${paperPath(slug)}`,
        pdfUrl: hosted ? `${ORIGIN}${paperPdfPath(slug)}` : null,
      });
    } catch (error) {
      tagFailures.push(`${paper.id}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    tagged += 1;
    const names = tags.map((t) => t.name);
    for (const required of REQUIRED_CITATION_TAGS) {
      if (!names.includes(required)) tagFailures.push(`${paper.id}: no ${required}`);
    }
    const authors = tags.filter((t) => t.name === "citation_author");
    authorTags += authors.length;
    /*
     * ONE TAG PER AUTHOR, not one joined string. The commonest way to get this
     * wrong produces a single author whose name is the whole list, and this
     * corpus makes that vivid: one record has 100 names and another 144.
     */
    if (authors.length !== paper.authors.length) {
      tagFailures.push(
        `${paper.id}: ${authors.length} citation_author tags for ${paper.authors.length} authors`,
      );
    }
    const pdf = tags.find((t) => t.name === "citation_pdf_url");
    if (hosted && !pdf) tagFailures.push(`${paper.id}: hosted but no citation_pdf_url`);
    if (!hosted && pdf) tagFailures.push(`${paper.id}: not hosted but has citation_pdf_url`);
    if (pdf) {
      pdfTags += 1;
      /*
       * SAME SUBDIRECTORY AS THE ABSTRACT PAGE. Scholar: "For security reasons,
       * it must refer to a file in the same subdirectory as the HTML abstract."
       * Asserted on the tag rather than on the path helper, because this is the
       * string that ships.
       */
      const dir = `${ORIGIN}${paperPath(slug)}`;
      if (!pdf.content.startsWith(dir)) {
        tagFailures.push(`${paper.id}: citation_pdf_url is not under ${dir}`);
      }
    }
  }

  assertThat(
    tagged === PUBLICATIONS.length,
    `every record produces a citation tag set (${tagged} of ${PUBLICATIONS.length})`,
    "a zero here would make every assertion in this block vacuous",
  );
  assertThat(
    authorTags > 0 && pdfTags > 0,
    `the tag sets carry authors and PDFs (${authorTags} author tags, ${pdfTags} pdf tags)`,
    "both counts must be non-zero or the shape checks above read nothing",
  );
  assertThat(
    tagFailures.length === 0,
    "every record's citation tags carry the required set and one tag per author",
    tagFailures.slice(0, 6).join("; "),
  );

  /*
   * AND THE ROUTE ACTUALLY CALLS IT. Comments stripped first, because this file
   * and the route both discuss the builder in prose and a raw match would read
   * the explanation as the code.
   */
  const routeSource = readFileSync(
    join(root, "app", "routes", "publications.$slug.tsx"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  assertThat(
    /buildCitationTags\s*\(/.test(routeSource),
    "the paper route calls buildCitationTags",
    "a correct builder nobody calls is a page with no citation tags",
  );
  assertThat(
    /import\s*\{[^}]*buildCitationTags[^}]*\}\s*from\s*"~\/lib\/publications\/citation-tags\.mjs"/.test(
      routeSource,
    ),
    "the paper route imports buildCitationTags from the gated module",
    "a locally defined builder would satisfy the call check above and be unchecked",
  );
}

/* ------------------------------------------------------ the plain-language line */

/*
 * `summary` is hand-written and is null on every record until somebody writes
 * one. These assertions are about SHAPE, and they are deliberately the only
 * thing gated here: a gate can check that a sentence is one sentence and short
 * enough, and it cannot check that it is any good or that it is true of the
 * paper. Saying so is the point, because a green gate on this field must not
 * read as "the summaries are fine".
 *
 * THE PAIRED COUNT MATTERS MORE THAN USUAL HERE. Today every record is null, so
 * every "no summary does X" assertion below passes over an empty set. That is
 * the vacuity case in its purest form, so the count of non-null summaries is
 * reported rather than assumed, and it will read 0 until the field is filled.
 */
{
  const summaries = siteEntries
    .map(([, f]) => [f.id, f.summary])
    .filter(([, value]) => value !== null && value !== undefined);

  console.log(
    `        (${summaries.length} of ${siteEntries.length} records carry a ` +
      "plain-language line; the assertions below are vacuous at zero, by design)",
  );

  const tooLong = summaries.filter(([, v]) => String(v).length > 200);
  assertThat(
    tooLong.length === 0,
    `no plain-language line exceeds 200 characters (${summaries.length} checked)`,
    tooLong.map(([id, v]) => `${id} is ${String(v).length}`).join(", "),
  );

  /*
   * ONE SENTENCE. Counted as terminal punctuation followed by a space and a
   * capital, which is what a second sentence looks like; a trailing full stop
   * is not a second sentence and "p < 0.05. The" is. Deliberately loose: this
   * is a nudge toward the format, not a grammar checker.
   */
  const multiSentence = summaries.filter(([, v]) => /[.!?]\s+[A-Z]/.test(String(v)));
  assertThat(
    multiSentence.length === 0,
    "every plain-language line is a single sentence",
    multiSentence.map(([id]) => id).join(", "),
  );

  /*
   * THE HOUSE DASH RULE, which the PreToolUse hook cannot reach here: these
   * strings live in a JSON data file that a person edits, and the hook guards
   * writes made through the agent's tools. Written as escapes so this file
   * stays clean and greppable, per the portfolio rule.
   */
  const WIDE_DASH = new RegExp("[\\u2013\\u2014]");
  const dashed = summaries.filter(([, v]) => WIDE_DASH.test(String(v)));
  assertThat(
    dashed.length === 0,
    "no plain-language line carries an em dash or en dash",
    dashed.map(([id]) => id).join(", "),
  );

  const empty = summaries.filter(([, v]) => String(v).trim().length === 0);
  assertThat(
    empty.length === 0,
    "no plain-language line is present but blank",
    `${empty.map(([id]) => id).join(", ")}. Absent is a state; empty is a mistake.`,
  );
}

/* ---------------------------------------------------------------- cited by */

/*
 * THE CITED-BY ARTIFACT IS DATED EVIDENCE, and these assertions are about the
 * ways a dated artifact goes wrong rather than about the numbers in it. The
 * numbers are OpenAlex's and this gate has no way to check them; what it can
 * check is that the file describes THIS corpus, that it is not silently
 * truncated, and that it says when it was read.
 */
{
  const citedByPath = join(root, "data", "publications.cited-by.json");
  assertThat(
    existsSync(citedByPath),
    "the cited-by artifact exists",
    "regenerate with `node scripts/fetch-cited-by.mjs --write`",
  );
  if (existsSync(citedByPath)) {
    const artifact = JSON.parse(readFileSync(citedByPath, "utf8"));
    const works = artifact.works ?? {};
    const keys = Object.keys(works);

    assertThat(
      keys.length > 0,
      `the cited-by artifact carries records (${keys.length})`,
      "every assertion below iterates it",
    );
    assertThat(
      /^\d{4}-\d{2}-\d{2}$/.test(String(artifact.fetchedAt ?? "")),
      `the artifact records the date it was read (${artifact.fetchedAt})`,
      "the page prints this date beside the list; an absent one would print a " +
        "list with no provenance, which is a claim with no age",
    );

    const strays = keys.filter((doi) => !Object.hasOwn(site, doi));
    assertThat(
      strays.length === 0,
      "every cited-by key is a DOI this corpus carries",
      strays.join(", "),
    );
    const uncovered = siteEntries.filter(([doi]) => !Object.hasOwn(works, doi));
    assertThat(
      uncovered.length === 0,
      `every corpus record has a cited-by entry (${keys.length} of ${siteEntries.length})`,
      uncovered.length
        ? `${uncovered.map(([, f]) => f.id).join(", ")}. A missing entry and a zero ` +
            "entry are different facts, and the page renders them differently."
        : "",
    );

    /*
     * THE CAP IS RESPECTED AND THE TRUE TOTAL SURVIVES IT. One record has 52
     * citing works against a cap of 50, and the page says "50 of 52" only
     * because both numbers are in the file. A list longer than the cap would
     * mean the fetcher stopped honouring it; a `total` below the list length
     * would mean the two came from different reads.
     */
    const cap = Number(artifact.maxCiting ?? 0);
    assertThat(cap > 0, `the artifact records its own cap (${cap})`);
    const overCap = keys.filter((d) => (works[d].citing?.length ?? 0) > cap);
    assertThat(
      overCap.length === 0,
      `no entry exceeds the cap (${cap})`,
      overCap.join(", "),
    );
    const totalBelowList = keys.filter(
      (d) => Number(works[d].total ?? 0) < (works[d].citing?.length ?? 0),
    );
    assertThat(
      totalBelowList.length === 0,
      "no entry's total is below the number of works listed under it",
      totalBelowList.length
        ? `${totalBelowList.join(", ")}. The two came from different reads.`
        : "",
    );

    const citingCount = keys.reduce((n, d) => n + (works[d].citing?.length ?? 0), 0);
    assertThat(
      citingCount > 0,
      `the artifact lists citing works (${citingCount})`,
      "a zero would make the shape assertions below vacuous",
    );
    /*
     * A DOI HERE IS A BARE NAME, NOT A URL. OpenAlex returns
     * `https://doi.org/10.x/y` and the fetcher strips the prefix, because the
     * page builds its own link. A URL that slipped through would render as
     * `https://doi.org/https://doi.org/...`.
     */
    const urlShaped = keys.flatMap((d) =>
      (works[d].citing ?? []).filter((/** @type {any} */ w) => w.doi?.startsWith("http")),
    );
    assertThat(
      urlShaped.length === 0,
      "every citing DOI is a bare name rather than a URL",
      urlShaped.slice(0, 3).map((/** @type {any} */ w) => w.doi).join(", "),
    );
  }
}

/* ------------------------------------------------------------------ exports */

/*
 * THE EXPORTS ARE BYTE-GATED, which means two things and both are asserted.
 *
 * DETERMINISTIC: generated twice in one process, compared. An export that
 * differed between two downloads of an unchanged corpus would be a citation
 * file that looks modified when nothing about the work changed, and it would
 * defeat every byte comparison downstream. The commonest cause is a generation
 * timestamp, which is why the header deliberately carries none.
 *
 * COMPLETE: every record the export claims to carry is in it. A format writer
 * that silently dropped a record would produce a file that parses, imports, and
 * is missing a paper, which nobody notices until a bibliography is short.
 */
/*
 * Read as DATA, by importing the generated module, not by parsing its source
 * text for `type: "..."` lines. That was the first draft and it is the
 * four-space-indent trap archive/publications.md records twice: a line matcher
 * anchored on indentation matches whatever else happens to sit at that indent,
 * and it goes wrong silently by counting too much.
 */
const showcase = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

assertThat(
  showcase.length > 0,
  `the showcase set is non-empty (${showcase.length} of ${siteEntries.length})`,
  "every export assertion below iterates it",
);

/*
 * THE SHOWCASE SET IS STATED TWICE AND THIS IS WHAT KEEPS THEM EQUAL.
 *
 * `publications.tsx` declares it for the page and `export-response.mjs`
 * declares it for the exports, because importing a route module into an export
 * route would drag React and a loader along with it. Two statements of one
 * decision is exactly the drift this repo gates elsewhere, so it is gated here:
 * the route's literal is parsed out of its source and compared against the
 * imported set.
 */
{
  const routeSource = readFileSync(
    join(root, "app", "routes", "publications.tsx"),
    "utf8",
  );
  const block = /const SHOWCASE_TYPES = new Set<PublicationType>\(\[([\s\S]*?)\]\)/.exec(
    routeSource,
  );
  const routeTypes = new Set(
    [...(block?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1]),
  );
  assertThat(
    routeTypes.size > 0,
    `the route's SHOWCASE_TYPES literal is parseable (${routeTypes.size} types)`,
    "a failed parse would make the comparison below vacuous",
  );
  const onlyRoute = [...routeTypes].filter((t) => !SHOWCASE_TYPES.has(t));
  const onlyExport = [...SHOWCASE_TYPES].filter((t) => !routeTypes.has(t));
  assertThat(
    onlyRoute.length === 0 && onlyExport.length === 0,
    "the page and the exports agree about which types are shown",
    `only in the route: ${onlyRoute.join(", ") || "none"}; ` +
      `only in export-response.mjs: ${onlyExport.join(", ") || "none"}`,
  );
}

{
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  const bib = toBibtexAll(papers);
  const ris = toRisAll(papers);
  const csl = toCslJson(JSON.parse(readFileSync(CSL_PATH, "utf8")));

  assertThat(
    toBibtexAll(papers) === bib && toRisAll(papers) === ris,
    "the exports are byte-identical across two generations",
    "an export that changes without the corpus changing cannot be cited",
  );

  const bibEntries = (bib.match(/^@/gm) ?? []).length;
  assertThat(
    bibEntries === papers.length,
    `the BibTeX export carries one entry per shown record (${bibEntries})`,
    `${papers.length} records, ${bibEntries} entries`,
  );
  const risRecords = (ris.match(/^TY {2}- /gm) ?? []).length;
  const risTerminators = (ris.match(/^ER {2}- $/gm) ?? []).length;
  assertThat(
    risRecords === papers.length && risTerminators === papers.length,
    `the RIS export carries one terminated record per shown record (${risRecords})`,
    `${papers.length} records, ${risRecords} TY tags, ${risTerminators} ER tags. ` +
      "An unterminated record swallows the next one on import.",
  );

  const missingDoi = papers.filter((p) => !bib.includes(p.doi) || !ris.includes(p.doi));
  assertThat(
    missingDoi.length === 0,
    "every shown record's DOI appears in both text exports",
    missingDoi.map((p) => p.id).join(", "),
  );

  /*
   * NO CHARACTER REFERENCE SURVIVES. The stored corpus keeps them escaped on
   * purpose; an export is read by a reference manager, which would show a
   * reader `p &lt; 0.05`. Paired with the count above so the sweep cannot pass
   * by reading an empty file.
   */
  const leaked = /&(amp|lt|gt|quot|apos|#\d+);/.exec(bib + ris + csl);
  assertThat(
    leaked === null,
    "no character reference survives into any export",
    leaked ? `found ${leaked[0]}` : "",
  );

  /*
   * BRACE PROTECTION, asserted where it MATTERS rather than in general. Many
   * BibTeX styles lowercase a title, and a lowercased genus is wrong under the
   * nomenclature codes rather than merely ugly.
   */
  const withOrganism = papers.filter((p) => organismsIn(p.title).length > 0);
  assertThat(
    withOrganism.length > 0,
    `some shown titles carry an organism name (${withOrganism.length})`,
    "a zero would make the brace assertion below vacuous",
  );
  /*
   * ASKED THROUGH `organismsIn`, which is the matcher the code uses, NOT
   * through `ORGANISMS.some((o) => title.includes(o))`.
   *
   * The substring form was the first draft and it failed five records whose
   * output was correct: a title carrying "Mycobacterium smegmatis" also
   * contains "Mycobacterium", so it demanded a brace the longest-first matcher
   * rightly never emits. A gate that asks a different question from the one the
   * code answers reports a defect that is its own.
   */
  const unprotected = withOrganism.filter((p) => {
    const entry = toBibtex(p);
    return organismsIn(p.title).some((o) => !entry.includes(`{${o}}`));
  });
  assertThat(
    unprotected.length === 0,
    "every organism name in a title is brace-protected in BibTeX",
    unprotected.map((p) => p.id).join(", "),
  );

  /* DOIs AS DEPOSITED. Six of the 36 are mixed case; a lowercasing export would
     disagree with the registry it came from. */
  const folded = papers.filter(
    (p) => p.doi !== p.doi.toLowerCase() && !bib.includes(`doi = {${p.doi}}`),
  );
  assertThat(
    folded.length === 0,
    "mixed-case DOIs are exported as deposited",
    folded.map((p) => p.id).join(", "),
  );
}

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
 * EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE, never summed from the
 * assertion list above. Slack of two, the convention `check:secrets` records:
 * this gate's count moves only when an assertion is written, so it does not
 * need room to breathe.
 *
 * 21 on 2026-09-12 at the restore. RE-MEASURED the same day at 29, when the
 * slug, PDF-location and redirect-map assertions landed with the per-paper
 * pages, and again at 40 when the citation exports did. Each number comes from
 * a run. The export block earned its keep on that run: its brace-protection
 * assertion failed five records whose output was correct, because it asked
 * `title.includes(organism)` where the code asks a longest-first matcher, and
 * a title carrying "Mycobacterium smegmatis" contains "Mycobacterium" too.
 * 50 when the cited-by artifact's assertions landed, and 64 with the rights
 * allowlist, the Highwire tag set and the plain-language line. Every number
 * from a run.
 *
 * The rights block also earned its place on its first run, by finding that
 * `licenseSource: null` was carrying two meanings at once, checked-and-empty
 * and never-checked, on exactly the four closed records where the difference
 * decides whether a hosting decision was made or merely inherited. The pipeline
 * now writes `none-deposited` and null means one thing.
 */
const MINIMUM_CHECKS = 62;
const floorBreach = assertFloor("check:publications", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) {
  console.error(`\ncheck:publications failed. ${floorBreach}`);
  process.exit(1);
}

console.log(`\n${checks} checks, ${failures.length} failures`);
if (failures.length > 0) process.exit(1);
