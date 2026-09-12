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
import { doiSlug, paperPdfPath } from "../app/lib/publications/paths.mjs";
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
 */
const MINIMUM_CHECKS = 38;
const floorBreach = assertFloor("check:publications", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) {
  console.error(`\ncheck:publications failed. ${floorBreach}`);
  process.exit(1);
}

console.log(`\n${checks} checks, ${failures.length} failures`);
if (failures.length > 0) process.exit(1);
