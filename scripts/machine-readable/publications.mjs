import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generate } from "../build-publications.mjs";
import { generateTwins } from "../build-publication-twins.mjs";
import {
  doiSlug,
  paperAskUrl,
  paperMarkdownPath,
  paperPath,
  paperPdfPath,
} from "../../app/lib/publications/paths.mjs";
import { decodeEntities } from "../../app/lib/publications/entities.mjs";
import { accessionUrl, accessionsInText } from "../../app/lib/publications/accessions.mjs";
import { updateNoticeProblem } from "../../app/lib/publications/update-notice.mjs";
import { paperSearchInputs } from "../../app/lib/publications/search-inputs.mjs";
import { recordsForPapers } from "../../app/lib/search/records.mjs";
import { keyForUrl, urlForKey } from "../../app/lib/search/ask-keys.mjs";
import {
  buildCitationTags,
  REQUIRED_CITATION_TAGS,
} from "../../app/lib/publications/citation-tags.mjs";
import { PUBLICATIONS } from "../../app/data/publications.ts";
import { SHOWCASE_TYPES } from "../../app/lib/publications/export-response.mjs";
import {
  organismsIn,
  toBibtex,
  toBibtexAll,
  toCslJson,
  toRisAll,
} from "../../app/lib/publications/exports.mjs";
import { assertFloor } from "../lib/floor.mjs";
import { createTally } from "../lib/tally.mjs";
import { stripTsxComments } from "../lib/strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The paper route, read once and stripped by the TSX parser: the route discusses the builders it
 * calls in prose, and a `//` regex also ate every `https://` inside a string.
 */
const SLUG_ROUTE = stripTsxComments(
  readFileSync(join(root, "app", "routes", "publications.$slug.tsx"), "utf8"),
);

const tally = createTally({ printPass: true });
const { ok } = tally;

/** @param {string} doi */
const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

console.log("\n  publications\n");

const SITE_PATH = join(root, "data", "publications.site.json");
const CSL_PATH = join(root, "data", "publications.csl.json");
const OUT_PATH = join(root, "app", "data", "publications.ts");

for (const [label, path] of [
  ["the site file", SITE_PATH],
  ["the CSL file", CSL_PATH],
  ["the generated module", OUT_PATH],
]) {
  if (!existsSync(path)) {
    console.log(`  FAIL  publications: ${label} is missing: ${path}`);
    throw new Error(`publications: ${label} is missing`);
  }
}

const site = JSON.parse(readFileSync(SITE_PATH, "utf8"));
const csl = JSON.parse(readFileSync(CSL_PATH, "utf8"));
const siteEntries = Object.entries(site);

ok(
  "both source files carry records",
  siteEntries.length > 0 && Array.isArray(csl) && csl.length > 0,
  `site ${siteEntries.length}, csl ${Array.isArray(csl) ? csl.length : "not an array"}`,
);
if (siteEntries.length === 0 || !Array.isArray(csl) || csl.length === 0) {
  throw new Error("publications: the scope is empty; nothing below would mean anything");
}

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
  ok(
    `app/data/publications.ts matches a fresh generation (${emitted.length} bytes)`,
    committed === emitted,
    detail,
  );
}

const cslByDoi = new Map();
let duplicateCsl = "";
for (const record of csl) {
  const key = doiKey(record.DOI ?? record.id);
  if (cslByDoi.has(key)) duplicateCsl = record.DOI ?? record.id;
  cslByDoi.set(key, record);
}
ok(
  `every CSL DOI is distinct after casefolding (${cslByDoi.size} of ${csl.length})`,
  duplicateCsl === "",
  duplicateCsl ? `two records share ${duplicateCsl} once casefolded` : "",
);

const siteKeys = siteEntries.map(([doi]) => doiKey(doi));
ok(
  `every site DOI is distinct after casefolding (${new Set(siteKeys).size} of ${siteKeys.length})`,
  new Set(siteKeys).size === siteKeys.length,
  "DOI names are case-insensitive per spec, so two casings of one DOI are one work",
);

ok(
  `the two files describe the same number of works (${siteEntries.length})`,
  siteEntries.length === csl.length,
  `site ${siteEntries.length}, csl ${csl.length}`,
);

const unjoined = siteKeys.filter((key) => !cslByDoi.has(key));
ok(
  "every site record joins a CSL record",
  unjoined.length === 0,
  unjoined.length ? `no CSL record for: ${unjoined.join(", ")}` : "",
);

const ids = siteEntries.map(([, f]) => f.id);
ok(
  `every record id is unique (${new Set(ids).size} of ${ids.length})`,
  new Set(ids).size === ids.length,
);

const hosted = siteEntries.filter(([, f]) => f.pdfPath);
const missingPdfs = hosted
  .filter(([, f]) => !existsSync(join(root, "public", f.pdfPath.replace(/^\//, ""))))
  .map(([, f]) => f.pdfPath);
ok(
  `every pdfPath resolves to a file on disk (${hosted.length} hosted)`,
  missingPdfs.length === 0,
  missingPdfs.length ? `missing: ${missingPdfs.join(", ")}` : "",
);
ok(
  "the hosted set is non-empty, so the assertion above read something",
  hosted.length > 0,
  "a zero here would make the missing-PDF sweep vacuous",
);

const emptyPdfs = hosted
  .filter(([, f]) => {
    const p = join(root, "public", f.pdfPath.replace(/^\//, ""));
    return existsSync(p) && statSync(p).size === 0;
  })
  .map(([, f]) => f.pdfPath);
ok(
  "no hosted PDF is a zero-byte file",
  emptyPdfs.length === 0,
  emptyPdfs.length ? `empty: ${emptyPdfs.join(", ")}` : "",
);

const TEXT_PATH = join(root, "data", "publications.text.json");
ok(
  "data/publications.text.json exists",
  existsSync(TEXT_PATH),
  "run node scripts/extract-publication-text.mjs; every assertion below reads it",
);

const extracted = existsSync(TEXT_PATH)
  ? JSON.parse(readFileSync(TEXT_PATH, "utf8"))
  : { papers: {} };
const extractedPapers = extracted.papers ?? {};
const extractedKeys = new Set(Object.keys(extractedPapers).map((d) => doiKey(d)));

ok(
  `the extracted-text artifact is non-empty (${Object.keys(extractedPapers).length} PDFs)`,
  Object.keys(extractedPapers).length > 0,
  "an empty artifact would make every sweep below vacuous",
);

const untexted = hosted.filter(([doi]) => !extractedKeys.has(doiKey(doi))).map(([doi]) => doi);
ok(
  `every hosted PDF has extracted text (${hosted.length} hosted)`,
  untexted.length === 0,
  untexted.length ? `no text for: ${untexted.join(", ")}` : "",
);

const hostedKeys = new Set(hosted.map(([doi]) => doiKey(doi)));
const orphanText = [...extractedKeys].filter((key) => !hostedKeys.has(key));
ok(
  "the extracted-text artifact carries no entry this site does not host",
  orphanText.length === 0,
  orphanText.length ? `orphaned: ${orphanText.join(", ")}` : "",
);

/* Hashed, never size or mtime: a re-exported PDF of the same length is the likely case. */
const staleText = [];
for (const [doi, fields] of hosted) {
  const entry = extractedPapers[doi] ?? extractedPapers[doiKey(doi)];
  if (!entry) continue;
  const diskPath = join(root, "public", fields.pdfPath.replace(/^\//, ""));
  if (!existsSync(diskPath)) continue;
  const sha = createHash("sha256").update(readFileSync(diskPath)).digest("hex");
  if (sha !== entry.sha256) staleText.push(`${doi} (pdf ${sha.slice(0, 12)}, text says ${String(entry.sha256).slice(0, 12)})`);
}
ok(
  "every extracted text matches the sha256 of the PDF on disk",
  staleText.length === 0,
  staleText.length
    ? `re-run scripts/extract-publication-text.mjs. Stale: ${staleText.join("; ")}`
    : "",
);

const inconsistentText = Object.entries(extractedPapers)
  .filter(([, entry]) => {
    const pages = Array.isArray(entry.text) ? entry.text : [];
    const chars = pages.reduce((/** @type {number} */ sum, /** @type {unknown} */ page) => sum + String(page).length, 0);
    return pages.length !== entry.pages || chars !== entry.chars;
  })
  .map(([doi]) => doi);
ok(
  "every extracted entry's page and character counts match its own text",
  inconsistentText.length === 0,
  inconsistentText.length ? `inconsistent: ${inconsistentText.join(", ")}` : "",
);

/* A scanned PDF extracts to nothing and everything above still passes. */
const emptyText = Object.entries(extractedPapers)
  .filter(([, entry]) => (entry.chars ?? 0) < 500)
  .map(([doi, entry]) => `${doi} (${entry.chars})`);
ok(
  "no extracted text is empty or near-empty",
  emptyText.length === 0,
  emptyText.length
    ? `extraction produced almost nothing for: ${emptyText.join(", ")}. ` +
        "A scanned PDF with no text layer looks exactly like this."
    : "",
);

const accessMismatch = siteEntries.filter(
  ([, f]) =>
    (f.access === "self-hosted" && !f.pdfPath) ||
    (f.access === "external" && f.pdfPath),
);
ok(
  "access agrees with pdfPath on every record",
  accessMismatch.length === 0,
  accessMismatch.length
    ? accessMismatch.map(([, f]) => `${f.id} is ${f.access} with pdfPath ${f.pdfPath}`).join("; ")
    : "",
);

/* Landing-page form answers for every PMCID, including those the API refuses. */
const withPmc = siteEntries.filter(([, f]) => f.pmcUrl);
const badPmcUrls = withPmc
  .filter(([, f]) => !/^https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/$/.test(f.pmcUrl))
  .map(([, f]) => f.pmcUrl);
ok(
  `every pmcUrl is in landing-page form (${withPmc.length} carry one)`,
  badPmcUrls.length === 0,
  badPmcUrls.length ? `not landing-page form: ${badPmcUrls.join(", ")}` : "",
);
ok(
  "the pmcUrl set is non-empty, so the form assertion above read something",
  withPmc.length > 0,
);

const pmcMismatch = siteEntries.filter(
  ([, f]) => Boolean(f.pmcid) !== Boolean(f.pmcUrl),
);
ok(
  "pmcid and pmcUrl are present together or absent together",
  pmcMismatch.length === 0,
  pmcMismatch.length ? pmcMismatch.map(([, f]) => f.id).join(", ") : "",
);

/* These land in a `<script type="application/ld+json">` block, where `<` ends the element early. */
const abstracts = csl.filter((c) => typeof c.abstract === "string" && c.abstract.length > 0);
const withAngle = abstracts.filter((c) => c.abstract.includes("<")).map((c) => c.DOI);
ok(
  `no stored abstract contains a left angle bracket (${abstracts.length} read)`,
  withAngle.length === 0,
  withAngle.length ? `contains "<": ${withAngle.join(", ")}` : "",
);
ok(
  "the abstract set is non-empty, so the bracket sweep above read something",
  abstracts.length > 0,
  "this is the companion the July build added after an assertion passed by reading zero",
);

/* Only inside the TOPICS block: an indent-anchored matcher over the whole module sweeps in every id. */
const generated = readFileSync(OUT_PATH, "utf8");
const topicsBlock = /export const TOPICS: Topic\[\] = \[([\s\S]*?)\n\];/.exec(generated);
ok(
  "the generated module carries a parseable TOPICS block",
  Boolean(topicsBlock),
  "the block is the only source for declared topic ids; without it the check below is vacuous",
);
const declaredTopics = new Set(
  [...(topicsBlock?.[1] ?? "").matchAll(/^\s{4}id: "([^"]+)",$/gm)].map((m) => m[1]),
);
ok(
  `the TOPICS block declares more than one topic (${declaredTopics.size})`,
  declaredTopics.size >= 2,
  "one or zero would mean the parse above matched something other than the block",
);
const undeclared = [
  ...new Set(siteEntries.flatMap(([, f]) => f.topics ?? []).filter((t) => !declaredTopics.has(t))),
];
ok(
  `every topic a record claims is declared (${declaredTopics.size} declared)`,
  undeclared.length === 0,
  undeclared.length ? `undeclared: ${undeclared.join(", ")}` : "",
);
const untopiced = siteEntries.filter(([, f]) => !f.topics || f.topics.length === 0);
ok(
  "every record carries at least one topic",
  untopiced.length === 0,
  untopiced.length ? untopiced.map(([, f]) => f.id).join(", ") : "",
);

/* The slug is lossy, so a collision is two papers on one URL. */
const slugs = siteEntries.map(([doi]) => doiSlug(doi));
const slugCounts = new Map();
for (const slug of slugs) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
const collided = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
ok(
  `every DOI produces a distinct page slug (${slugCounts.size} of ${slugs.length})`,
  collided.length === 0,
  collided.length
    ? `these slugs are claimed by more than one DOI: ${collided.join(", ")}. ` +
        "doiSlug collapses punctuation, so two DOIs differing only in punctuation collide."
    : "",
);
ok(
  "every slug is a single lower-case path segment",
  slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
  slugs.filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)).join(", "),
);

/* `pdfPath` stays a literal because `build:template-refs` matches asset references as literals. */
const pathMismatch = siteEntries
  .filter(([doi, f]) => f.pdfPath && f.pdfPath !== paperPdfPath(doiSlug(doi)))
  .map(([doi, f]) => `${f.id}: ${f.pdfPath} should be ${paperPdfPath(doiSlug(doi))}`);
ok(
  `every hosted pdfPath is the path paperPdfPath derives (${hosted.length} checked)`,
  pathMismatch.length === 0,
  pathMismatch.join("; "),
);

/* What Scholar cares about: `paperPdfPath` can move while the equality above passes. */
const outsideOwnDirectory = siteEntries
  .filter(([doi, f]) => f.pdfPath && !f.pdfPath.startsWith(`/publications/${doiSlug(doi)}/`))
  .map(([, f]) => f.id);
ok(
  "every hosted PDF is in the same subdirectory as its paper's page",
  outsideOwnDirectory.length === 0,
  outsideOwnDirectory.length
    ? `${outsideOwnDirectory.join(", ")}. Google Scholar only honors ` +
        "citation_pdf_url when the file is in the abstract page's own subdirectory."
    : "",
);

/* Both directions: a one-way check passes on an entry pointing at nothing, a 301 into a 404. */
const redirects = JSON.parse(readFileSync(join(root, "content", "redirects.json"), "utf8"));
const pdfRedirects = redirects.pdfs ?? {};
const redirectTargets = new Set(Object.values(pdfRedirects));
const hostedPaths = new Set(hosted.map(([, f]) => f.pdfPath));

ok(
  `the PDF redirect map is populated (${Object.keys(pdfRedirects).length} entries)`,
  Object.keys(pdfRedirects).length > 0,
  "an empty map would make both directions below vacuous",
);
const unredirected = [...hostedPaths].filter((p) => !redirectTargets.has(p));
ok(
  `every hosted PDF is the target of a redirect from its old URL (${hostedPaths.size} hosted)`,
  unredirected.length === 0,
  unredirected.length
    ? `no old URL redirects to: ${unredirected.join(", ")}. Every one of these ` +
        "was published at a flat path for seven weeks and that URL is a promise."
    : "",
);
const danglingTargets = [...redirectTargets].filter((p) => !hostedPaths.has(p));
ok(
  "every redirect target is a PDF the corpus actually hosts",
  danglingTargets.length === 0,
  danglingTargets.length ? `301 into nothing: ${danglingTargets.join(", ")}` : "",
);
const sourcesStillOnDisk = Object.keys(pdfRedirects).filter((p) =>
  existsSync(join(root, "public", p.replace(/^\//, ""))),
);
ok(
  "no redirect source is also a file on disk",
  sourcesStillOnDisk.length === 0,
  sourcesStillOnDisk.length
    ? `${sourcesStillOnDisk.join(", ")} exist as assets, and the static handler runs ` +
        "ahead of the Worker, so the redirect would never fire."
    : "",
);

/*
 * `licenseSource` has three states: tdm-only is terms that license redistribution to nobody, and
 * collapsing it would hide that those were checked.
 */
const HOSTED_WITHOUT_LICENCE = new Map([
  // Bronze is free to read on the publisher's site with no license, which they can reverse.
  ["10.1128/jvi.00356-08", "ASM, green OA, crossref:tdm-only"],
  ["10.1128/jvi.01788-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.03444-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.02150-14", "ASM, bronze OA, crossref:tdm-only"],
  // Not open access at all.
  ["10.1002/9780470025079.chap06.pub2", "Wiley chapter, closed, crossref:tdm-only"],
  ["10.1080/07448481.2025.2472184", "Taylor and Francis, closed"],
  ["10.7589/2018-08-187", "Journal of Wildlife Diseases, closed"],
  ["10.7589/2019-04-088", "Journal of Wildlife Diseases, closed since July"],
  ["10.7589/JWD-D-22-00023", "Journal of Wildlife Diseases, closed"],
]);

{
  const permitsRedistribution = (/** @type {string | null} */ licence) =>
    typeof licence === "string" &&
    (licence.startsWith("cc-by") || licence === "cc0" || licence === "public-domain");

  const hostedRecords = siteEntries.filter(([, f]) => f.pdfPath);
  const licensed = hostedRecords.filter(([, f]) => permitsRedistribution(f.license));
  const unlicensed = hostedRecords.filter(([, f]) => !permitsRedistribution(f.license));

  console.log(
    `        (${licensed.length} hosted with a redistribution license, ` +
      `${unlicensed.length} hosted without one and named below)`,
  );

  ok(
    `the hosted set is non-empty (${hostedRecords.length})`,
    hostedRecords.length > 0,
    "every rights assertion below iterates it",
  );
  ok(
    `some hosted PDFs carry a redistribution license (${licensed.length})`,
    licensed.length > 0,
    "a zero would mean the license predicate matches nothing and the split below is fake",
  );

  const undeclared = unlicensed.filter(([doi]) => !HOSTED_WITHOUT_LICENCE.has(doi));
  ok(
    `every PDF hosted without a license is named in this gate (${unlicensed.length})`,
    undeclared.length === 0,
    undeclared.length
      ? undeclared
          .map(([doi, f]) => `${f.id} (${doi}), license ${f.license ?? "none"}, ` +
            `source ${f.licenseSource ?? "none"}`)
          .join("; ") +
          ". Hosting a paper whose license does not permit it is Dustin's call to " +
          "make and is recorded per DOI, so a NEW one is a new decision rather " +
          "than a precedent."
      : "",
  );

  /* Stale exemptions are how an allowlist stops meaning anything. */
  const stale = [...HOSTED_WITHOUT_LICENCE.keys()].filter(
    (doi) => !unlicensed.some(([d]) => d === doi),
  );
  ok(
    "every DOI named here is still a PDF hosted without a license",
    stale.length === 0,
    stale.length
      ? `${stale.map((doi) => `${doi} (recorded as ${HOSTED_WITHOUT_LICENCE.get(doi)})`).join(", ")}. Either the file is gone or a registry now records ` +
          "terms; check which, then remove the entry."
      : "",
  );

  const unchecked = unlicensed.filter(([, f]) => !f.licenseSource && f.license === null);
  ok(
    `every unlicensed hosted record records what the registries said (${unlicensed.length})`,
    unchecked.length === 0,
    unchecked.length
      ? `${unchecked.map(([, f]) => f.id).join(", ")} carry neither a license nor a ` +
          "licenseSource, so it is not possible to tell a closed paper from an " +
          "unchecked one. Re-run pubs-pipeline/refresh.py."
      : "",
  );
}

/*
 * Not against the render: `createRoutesStub` never mounts `<Meta />`. Both halves, the builder
 * and the route calling it, since either alone is green while the page is wrong.
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
    const isHosted = paper.access === "self-hosted" && paper.pdfPath !== null;
    let tags;
    try {
      tags = buildCitationTags(paper, {
        abstractUrl: `${ORIGIN}${paperPath(slug)}`,
        pdfUrl: isHosted ? `${ORIGIN}${paperPdfPath(slug)}` : null,
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
    /* One tag per author: otherwise Scholar reads a single author whose name is the whole list. */
    if (authors.length !== paper.authors.length) {
      tagFailures.push(
        `${paper.id}: ${authors.length} citation_author tags for ${paper.authors.length} authors`,
      );
    }
    const pdf = tags.find((t) => t.name === "citation_pdf_url");
    if (isHosted && !pdf) tagFailures.push(`${paper.id}: hosted but no citation_pdf_url`);
    if (!isHosted && pdf) tagFailures.push(`${paper.id}: not hosted but has citation_pdf_url`);
    if (pdf) {
      pdfTags += 1;
      const dir = `${ORIGIN}${paperPath(slug)}`;
      if (!pdf.content.startsWith(dir)) {
        tagFailures.push(`${paper.id}: citation_pdf_url is not under ${dir}`);
      }
    }
  }

  ok(
    `every record produces a citation tag set (${tagged} of ${PUBLICATIONS.length})`,
    tagged === PUBLICATIONS.length,
    "a zero here would make every assertion in this block vacuous",
  );
  ok(
    `the tag sets carry authors and PDFs (${authorTags} author tags, ${pdfTags} pdf tags)`,
    authorTags > 0 && pdfTags > 0,
    "both counts must be non-zero or the shape checks above read nothing",
  );
  ok(
    "every record's citation tags carry the required set and one tag per author",
    tagFailures.length === 0,
    tagFailures.slice(0, 6).join("; "),
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper route calls buildCitationTags",
    /buildCitationTags\s*\(/.test(routeSource),
    "a correct builder nobody calls is a page with no citation tags",
  );
  ok(
    "the paper route imports buildCitationTags from the gated module",
    /import\s*\{[^}]*buildCitationTags[^}]*\}\s*from\s*"~\/lib\/publications\/citation-tags\.mjs"/.test(
      routeSource,
    ),
    "a locally defined builder would satisfy the call check above and be unchecked",
  );
}

{
  const summaries = siteEntries
    .map(([, f]) => [f.id, f.summary])
    .filter(([, value]) => value !== null && value !== undefined);

  console.log(
    `        (${summaries.length} of ${siteEntries.length} records carry a ` +
      "plain-language line; the assertions below are vacuous at zero, by design)",
  );

  const tooLong = summaries.filter(([, v]) => String(v).length > 200);
  ok(
    `no plain-language line exceeds 200 characters (${summaries.length} checked)`,
    tooLong.length === 0,
    tooLong.map(([id, v]) => `${id} is ${String(v).length}`).join(", "),
  );

  const multiSentence = summaries.filter(([, v]) => /[.!?]\s+[A-Z]/.test(String(v)));
  ok(
    "every plain-language line is a single sentence",
    multiSentence.length === 0,
    multiSentence.map(([id]) => id).join(", "),
  );

  /* The PreToolUse hook cannot reach data files, and the escapes keep this file free of the dashes. */
  const WIDE_DASH = new RegExp("[\\u2013\\u2014]");
  const dashed = summaries.filter(([, v]) => WIDE_DASH.test(String(v)));
  ok(
    "no plain-language line carries an em dash or en dash",
    dashed.length === 0,
    dashed.map(([id]) => id).join(", "),
  );

  const empty = summaries.filter(([, v]) => String(v).trim().length === 0);
  ok(
    "no plain-language line is present but blank",
    empty.length === 0,
    `${empty.map(([id]) => id).join(", ")}. Absent is a state; empty is a mistake.`,
  );
}

/* Asserts the artifact describes this corpus and says when, never its numbers. */
{
  const citedByPath = join(root, "data", "publications.cited-by.json");
  ok(
    "the cited-by artifact exists",
    existsSync(citedByPath),
    "regenerate with `node scripts/fetch-cited-by.mjs --write`",
  );
  if (existsSync(citedByPath)) {
    const artifact = JSON.parse(readFileSync(citedByPath, "utf8"));
    const works = artifact.works ?? {};
    const keys = Object.keys(works);

    ok(
      `the cited-by artifact carries records (${keys.length})`,
      keys.length > 0,
      "every assertion below iterates it",
    );
    ok(
      `the artifact records the date it was read (${artifact.fetchedAt})`,
      /^\d{4}-\d{2}-\d{2}$/.test(String(artifact.fetchedAt ?? "")),
      "the page prints this date beside the list; an absent one would print a " +
        "list with no provenance, which is a claim with no age",
    );

    const strays = keys.filter((doi) => !Object.hasOwn(site, doi));
    ok(
      "every cited-by key is a DOI this corpus carries",
      strays.length === 0,
      strays.join(", "),
    );
    const uncovered = siteEntries.filter(([doi]) => !Object.hasOwn(works, doi));
    ok(
      `every corpus record has a cited-by entry (${keys.length} of ${siteEntries.length})`,
      uncovered.length === 0,
      uncovered.length
        ? `${uncovered.map(([, f]) => f.id).join(", ")}. A missing entry and a zero ` +
            "entry are different facts, and the page renders them differently."
        : "",
    );

    const cap = Number(artifact.maxCiting ?? 0);
    ok(`the artifact records its own cap (${cap})`, cap > 0);
    const overCap = keys.filter((d) => (works[d].citing?.length ?? 0) > cap);
    ok(
      `no entry exceeds the cap (${cap})`,
      overCap.length === 0,
      overCap.join(", "),
    );
    const totalBelowList = keys.filter(
      (d) => Number(works[d].total ?? 0) < (works[d].citing?.length ?? 0),
    );
    ok(
      "no entry's total is below the number of works listed under it",
      totalBelowList.length === 0,
      totalBelowList.length
        ? `${totalBelowList.join(", ")}. The two came from different reads.`
        : "",
    );

    const citingCount = keys.reduce((n, d) => n + (works[d].citing?.length ?? 0), 0);
    ok(
      `the artifact lists citing works (${citingCount})`,
      citingCount > 0,
      "a zero would make the shape assertions below vacuous",
    );
    /* A bare name: the page builds its own link, so a URL renders a doubled `https://doi.org/`. */
    const urlShaped = keys.flatMap((d) =>
      (works[d].citing ?? []).filter((/** @type {any} */ w) => w.doi?.startsWith("http")),
    );
    ok(
      "every citing DOI is a bare name rather than a URL",
      urlShaped.length === 0,
      urlShaped.slice(0, 3).map((/** @type {any} */ w) => w.doi).join(", "),
    );
  }
}

const showcase = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

ok(
  `the showcase set is non-empty (${showcase.length} of ${siteEntries.length})`,
  showcase.length > 0,
  "every export assertion below iterates it",
);

/* Stated twice: importing the route module would drag React in, so its literal is parsed. */
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
  ok(
    `the route's SHOWCASE_TYPES literal is parseable (${routeTypes.size} types)`,
    routeTypes.size > 0,
    "a failed parse would make the comparison below vacuous",
  );
  const onlyRoute = [...routeTypes].filter((t) => !SHOWCASE_TYPES.has(t));
  const onlyExport = [...SHOWCASE_TYPES].filter((t) => !routeTypes.has(t));
  ok(
    "the page and the exports agree about which types are shown",
    onlyRoute.length === 0 && onlyExport.length === 0,
    `only in the route: ${onlyRoute.join(", ") || "none"}; ` +
      `only in export-response.mjs: ${onlyExport.join(", ") || "none"}`,
  );
}

{
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  const bib = toBibtexAll(papers);
  const ris = toRisAll(papers);
  const csl = toCslJson(JSON.parse(readFileSync(CSL_PATH, "utf8")));

  ok(
    "the exports are byte-identical across two generations",
    toBibtexAll(papers) === bib && toRisAll(papers) === ris,
    "an export that changes without the corpus changing cannot be cited",
  );

  const bibEntries = (bib.match(/^@/gm) ?? []).length;
  ok(
    `the BibTeX export carries one entry per shown record (${bibEntries})`,
    bibEntries === papers.length,
    `${papers.length} records, ${bibEntries} entries`,
  );
  const risRecords = (ris.match(/^TY {2}- /gm) ?? []).length;
  const risTerminators = (ris.match(/^ER {2}- $/gm) ?? []).length;
  ok(
    `the RIS export carries one terminated record per shown record (${risRecords})`,
    risRecords === papers.length && risTerminators === papers.length,
    `${papers.length} records, ${risRecords} TY tags, ${risTerminators} ER tags. ` +
      "An unterminated record swallows the next one on import.",
  );

  const missingDoi = papers.filter((p) => !bib.includes(p.doi) || !ris.includes(p.doi));
  ok(
    "every shown record's DOI appears in both text exports",
    missingDoi.length === 0,
    missingDoi.map((p) => p.id).join(", "),
  );

  /* The stored corpus keeps them escaped, and a reference manager would show `p &lt; 0.05`. */
  const leaked = /&(amp|lt|gt|quot|apos|#\d+);/.exec(bib + ris + csl);
  ok(
    "no character reference survives into any export",
    leaked === null,
    leaked ? `found ${leaked[0]}` : "",
  );

  /* A lowercased genus is wrong under the nomenclature codes. */
  const withOrganism = papers.filter((p) => organismsIn(p.title).length > 0);
  ok(
    `some shown titles carry an organism name (${withOrganism.length})`,
    withOrganism.length > 0,
    "a zero would make the brace assertion below vacuous",
  );
  const unprotected = withOrganism.filter((p) => {
    const entry = toBibtex(p);
    return organismsIn(p.title).some((o) => !entry.includes(`{${o}}`));
  });
  ok(
    "every organism name in a title is brace-protected in BibTeX",
    unprotected.length === 0,
    unprotected.map((p) => p.id).join(", "),
  );

  /* As deposited: a lowercasing export would disagree with the registry it came from. */
  const folded = papers.filter(
    (p) => p.doi !== p.doi.toLowerCase() && !bib.includes(`doi = {${p.doi}}`),
  );
  ok(
    "mixed-case DOIs are exported as deposited",
    folded.length === 0,
    folded.map((p) => p.id).join(", "),
  );
}

/* A count, so a second preprint is a decision somebody makes here. */
const preprints = siteEntries.filter(([, f]) => f.preprintDoi);
ok(
  `exactly one record carries a preprintDoi (${preprints.length})`,
  preprints.length === 1,
  preprints.map(([, f]) => `${f.id} -> ${f.preprintDoi}`).join(", "),
);

/*
 * Nothing imports the twins, so a build that never ran ships an llms.txt advertising 404s.
 * Compared in memory and never written first: a gate that repairs its subject cannot fail.
 */
const twins = await generateTwins();

ok(
  `one twin generated per record (${twins.size} of ${PUBLICATIONS.length})`,
  twins.size === PUBLICATIONS.length,
  "every assertion below iterates this map, so a short map is a quiet pass",
);

const TWIN_DIR = join(root, "public", "publications");
const missingTwins = [...twins.keys()].filter((name) => !existsSync(join(TWIN_DIR, name)));
ok(
  "every twin exists on disk",
  missingTwins.length === 0,
  missingTwins.length
    ? `run npm run build:publication-twins. Missing: ${missingTwins.join(", ")}`
    : "",
);

const driftedTwins = [...twins.entries()]
  .filter(([name, body]) => {
    const path = join(TWIN_DIR, name);
    return existsSync(path) && readFileSync(path, "utf8") !== body;
  })
  .map(([name]) => name);
ok(
  "every twin on disk matches a fresh generation",
  driftedTwins.length === 0,
  driftedTwins.length
    ? `stale, run npm run build:publication-twins: ${driftedTwins.join(", ")}`
    : "",
);

/* A corrected DOI leaves a file nothing overwrites. */
const strayTwins = readdirSync(TWIN_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .filter((name) => !twins.has(name));
ok(
  "no twin on disk belongs to a record this corpus no longer carries",
  strayTwins.length === 0,
  strayTwins.length ? `stray: ${strayTwins.join(", ")}` : "",
);

/* Matched on the URL, because a count passes on a list naming the wrong papers. */
const llms = readFileSync(join(root, "content", "llms.txt"), "utf8");
const advertised = new Set(
  [...llms.matchAll(/^\s{2}(\/publications\/[a-z0-9-]+\.md)$/gm)].map((m) => m[1]),
);
ok(
  `llms.txt lists markdown twins (${advertised.size} found)`,
  advertised.size > 0,
  "an empty set here would make both directions below vacuous",
);

const expectedTwinUrls = new Set([...twins.keys()].map((name) => `/publications/${name}`));
const unadvertised = [...expectedTwinUrls].filter((url) => !advertised.has(url));
ok(
  `every twin is listed in llms.txt (${expectedTwinUrls.size} twins)`,
  unadvertised.length === 0,
  unadvertised.length ? `absent from llms.txt: ${unadvertised.join(", ")}` : "",
);

const overAdvertised = [...advertised].filter((url) => !expectedTwinUrls.has(url));
ok(
  "llms.txt lists no twin this corpus does not produce",
  overAdvertised.length === 0,
  overAdvertised.length ? `advertised with no file: ${overAdvertised.join(", ")}` : "",
);

const textless = [];
for (const [doi, fields] of hosted) {
  const entry = extractedPapers[doi] ?? extractedPapers[doiKey(doi)];
  const body = twins.get(`${doiSlug(doi)}.md`) ?? "";
  if (!entry) continue;
  const marker = "## Full text";
  const at = body.indexOf(marker);
  // Half: the twin joins pages on a blank line and trims each, so it runs a little short, never half.
  if (at === -1 || body.length - at < entry.chars / 2) {
    textless.push(`${fields.id} (${at === -1 ? "no section" : "short"})`);
  }
}
ok(
  `every hosted paper's twin carries its extracted text (${hosted.length} hosted)`,
  textless.length === 0,
  textless.length ? `missing or truncated: ${textless.join(", ")}` : "",
);

/* Anchored to the named references, not a bare `&`: frontmatter URLs carry query strings. */
const entityTwins = [...twins.entries()]
  .filter(([, body]) => /&(?:amp|lt|gt|quot|apos|#\d+);/.test(body))
  .map(([name]) => name);
ok(
  "no twin carries an undecoded character reference",
  entityTwins.length === 0,
  entityTwins.length ? `still escaped in: ${entityTwins.join(", ")}` : "",
);

const paperRecords = recordsForPapers(paperSearchInputs(PUBLICATIONS));

ok(
  `one search record per paper (${paperRecords.length} of ${PUBLICATIONS.length})`,
  paperRecords.length === PUBLICATIONS.length,
  "every assertion below iterates this list",
);

{
  const ARTIFACT_PATH = join(root, "content", "generated", "posts.json");
  if (!existsSync(ARTIFACT_PATH)) {
    ok(
      "content/generated/posts.json exists, so the paper records can be compared",
      false,
      "run npm run build:content. check-all's preflight does this before any gate.",
    );
  } else {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
    const inArtifact = new Map(
      (artifact.records ?? [])
        .filter((/** @type {any} */ r) => String(r.uid).startsWith("paper:"))
        .map((/** @type {any} */ r) => [r.uid, r]),
    );
    const expected = new Map(paperRecords.map((r) => [r.uid, r]));

    const missingRecords = [...expected.keys()].filter((uid) => !inArtifact.has(uid));
    ok(
      `every paper has a record in the content artifact (${expected.size} papers)`,
      missingRecords.length === 0,
      missingRecords.length
        ? `absent from posts.json, run npm run build:content: ${missingRecords.join(", ")}`
        : "",
    );

    const strayRecords = [...inArtifact.keys()].filter((uid) => !expected.has(uid));
    ok(
      "the artifact carries no paper record this corpus does not produce",
      strayRecords.length === 0,
      strayRecords.length ? `stray: ${strayRecords.join(", ")}` : "",
    );

    const wrongUrls = [...expected.entries()]
      .filter(([uid, record]) => inArtifact.has(uid) && inArtifact.get(uid).url !== record.url)
      .map(([uid]) => uid);
    ok(
      "every paper record in the artifact points at the paper's page",
      wrongUrls.length === 0,
      wrongUrls.length ? `url mismatch: ${wrongUrls.join(", ")}` : "",
    );
  }
}

/* Classic search shows the line it matched, so two-column text would snippet a mangled one. */
{
  const oversized = paperRecords
    .filter((record) => {
      const doi = PUBLICATIONS.find((p) => record.uid === `paper:${doiSlug(p.doi)}`)?.doi;
      const entry = doi ? (extractedPapers[doi] ?? extractedPapers[doiKey(doi)]) : null;
      return entry ? record.body.length > entry.chars / 2 : false;
    })
    .map((record) => record.uid);
  ok(
    `no paper search record carries the PDF text (${hosted.length} hosted compared)`,
    oversized.length === 0,
    oversized.length ? `body is full-text sized: ${oversized.join(", ")}` : "",
  );
}

/* `keyForUrl` and `urlForKey` are asymmetric: a key that did not round-trip cites a 404. */
{
  const brokenKeys = PUBLICATIONS.map((paper) => {
    const slug = doiSlug(paper.doi);
    const key = keyForUrl(paperPath(slug));
    return { slug, key, back: urlForKey(key) };
  }).filter(
    ({ slug, key, back }) => key !== `publications/${slug}.md` || back !== paperPath(slug),
  );
  ok(
    `every paper's Ask key is its twin and maps back to its page (${PUBLICATIONS.length} papers)`,
    brokenKeys.length === 0,
    brokenKeys.length
      ? brokenKeys.map((b) => `${b.slug}: key ${b.key}, back ${b.back}`).join("; ")
      : "",
  );

  const keyPathMismatch = PUBLICATIONS.map((paper) => doiSlug(paper.doi)).filter(
    (slug) => `/${keyForUrl(paperPath(slug))}` !== paperMarkdownPath(slug),
  );
  ok(
    "every Ask key names the file the twin build writes",
    keyPathMismatch.length === 0,
    keyPathMismatch.length ? `key and twin path disagree: ${keyPathMismatch.join(", ")}` : "",
  );
}

{
  const badAskUrls = PUBLICATIONS.map((paper) => ({
    id: paper.id,
    url: paperAskUrl(decodeEntities(paper.title)),
  })).filter(({ url }) => !url.startsWith("/search?q=") || url.length > 600);
  ok(
    `paperAskUrl builds a /search query for every paper (${PUBLICATIONS.length})`,
    badAskUrls.length === 0,
    badAskUrls.length ? badAskUrls.map((b) => `${b.id}: ${b.url.slice(0, 80)}`).join("; ") : "",
  );

  /* The quoted title and nothing else, because the classic index ANDs its terms. */
  const notJustTheTitle = PUBLICATIONS.filter((paper) => {
    const title = decodeEntities(paper.title);
    const q = new URL(paperAskUrl(title), "https://example.invalid").searchParams.get("q");
    return q !== `"${title}"`;
  }).map((p) => p.id);
  ok(
    `the Ask query is the quoted title alone (${PUBLICATIONS.length} papers)`,
    notJustTheTitle.length === 0,
    notJustTheTitle.length
      ? `a term the record does not carry makes the classic half return nothing: ` +
          notJustTheTitle.join(", ")
      : "",
  );

  /* `query.mjs` reads a quoted run as a phrase, so a title carrying a quote splits it. */
  const quotedTitles = PUBLICATIONS.filter((p) => /["']/.test(p.title)).map((p) => p.id);
  ok(
    `no title contains a quotation mark (${PUBLICATIONS.length} read)`,
    quotedTitles.length === 0,
    quotedTitles.length
      ? `paperAskUrl quotes the title, so these would break the phrase: ${quotedTitles.join(", ")}`
      : "",
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper page calls paperAskUrl and imports it from paths.mjs",
    /paperAskUrl\(/.test(routeSource) &&
      /from "~\/lib\/publications\/paths\.mjs"/.test(routeSource),
    "a hand-built /search URL on the page would be a second owner of the question",
  );
  ok(
    "the paper page builds no /search URL of its own",
    !/href=\{`\/search\?q=/.test(routeSource),
    "found an interpolated /search href beside the one the module owns",
  );
}

{
  const noticed = PUBLICATIONS.filter((p) => p.updateNotice);
  ok(
    `no record carries a retraction or correction (${PUBLICATIONS.length} read)`,
    noticed.length === 0,
    noticed.length
      ? `notices on: ${noticed.map((p) => `${p.id} (${p.updateNotice?.type})`).join(", ")}`
      : "",
  );

  const malformed = PUBLICATIONS.map((p) => ({
    id: p.id,
    problem: updateNoticeProblem(p.updateNotice),
  })).filter(({ problem }) => problem !== null);
  ok(
    "every update notice present is well formed",
    malformed.length === 0,
    malformed.map((m) => `${m.id}: ${m.problem}`).join("; "),
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper page renders the notice through updateNoticeText",
    /updateNoticeText\(/.test(routeSource),
    "a sentence written into the route would be a second owner of what a " +
      "retraction says, on the one page where that has to be right",
  );
}

/* Anchored on the data-availability statement: a plain regex pulls in the comparison phages' accessions. */
{
  const derived = new Map();
  for (const [doi, entry] of Object.entries(extractedPapers)) {
    const found = accessionsInText(entry.text ?? []);
    if (found.length > 0) derived.set(doiKey(doi), found);
  }

  ok(
    `the data-availability sweep found accessions (${derived.size} papers)`,
    derived.size > 0,
    "a zero here would make both directions below vacuous",
  );

  const curated = new Map(
    siteEntries
      .filter(([, f]) => Array.isArray(f.accessions) && f.accessions.length > 0)
      .map(([doi, f]) => [doiKey(doi), f.accessions]),
  );

  const flat = (/** @type {any[]} */ list) =>
    list.map((a) => `${a.kind}:${a.id}`).sort().join(",");

  const unrecorded = [...derived.entries()]
    .filter(([key, found]) => flat(curated.get(key) ?? []) !== flat(found))
    .map(([key]) => key);
  ok(
    `every accession the PDFs name is in the corpus (${derived.size} papers with one)`,
    unrecorded.length === 0,
    unrecorded.length
      ? unrecorded
          .map(
            (key) =>
              `${key}: text says ${flat(derived.get(key) ?? [])}, corpus says ${flat(curated.get(key) ?? [])}`,
          )
          .join("; ")
      : "",
  );

  const unsupported = [...curated.keys()].filter((key) => !derived.has(key));
  ok(
    "no record claims an accession its PDF does not name",
    unsupported.length === 0,
    unsupported.length ? `unsupported: ${unsupported.join(", ")}` : "",
  );

  /* An SRA run under a nuccore URL is a 404 that looks like a working link. */
  const badLinks = [...curated.values()]
    .flat()
    .map((a) => ({ a, url: accessionUrl(a) }))
    .filter(({ a, url }) => !url.startsWith("https://www.ncbi.nlm.nih.gov/") || !url.endsWith(a.id));
  ok(
    `every accession builds an NCBI URL ending in its own id (${[...curated.values()].flat().length} accessions)`,
    badLinks.length === 0,
    badLinks.map(({ a, url }) => `${a.kind}:${a.id} -> ${url}`).join("; "),
  );
}

/* Measured 99 by running this part on 2026-09-24; the floor sits a little under it. */
const floorBreach = assertFloor(
  "check:machine-readable/publications",
  "checks",
  tally.checks,
  93,
  "The runner fails a part only on zero checks, so without this a refactor could drop " +
    "most of its sweeps and still pass.",
);
if (floorBreach) {
  console.log(`  FAIL  ${floorBreach}`);
  tally.fail(floorBreach);
}

export const outcome = { checks: tally.checks, failures: tally.failures };
