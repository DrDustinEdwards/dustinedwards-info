// Judges a parsed publication file (docs/PUBLICATIONS.md). check:machine-readable and the Carrel adapter's
// save both call this, so a file CI refuses is a file the save refuses, for the same reason in the same
// words. Every message starts with the field path, with no leading dot (`authors[2]: ...`).
//
// The checks that need the repository (does the PDF exist, does its hash match) and the other papers
// (is this id or DOI taken) arrive as `host` and `others`, so CI reads a clone and the Worker asks GitHub
// and D1 without this module knowing which.

import { contentIdFits } from "../carrel/content-id.mjs";
import { accessionUrl, accessionsInText } from "./accessions.mjs";
import { HOSTED_WITHOUT_LICENCE, permitsRedistribution } from "./hosting.mjs";
import { doiSlug, paperPdfPath } from "./paths.mjs";
import { updateNoticeProblem } from "./update-notice.mjs";
import { TOPIC_IDS } from "./topics.mjs";

const PUBLICATION_KIND = "publication";
const TYPES = /** @type {const} */ (["article", "review", "chapter", "abstract", "teaching-resource"]);
const ACCESS = /** @type {const} */ (["self-hosted", "external"]);
const STATUSES = /** @type {const} */ (["published", "submitted"]);

/** Every key a file may carry. Anything else is a typo that would be silently ignored. */
const FRONT_MATTER_FIELDS = new Set([
  "doi", "slug", "id", "status", "draft", "type", "title", "authors", "journal", "publishedDate", "year",
  "volume", "issue", "pages", "topics", "access", "pdfPath", "pdfSha256", "externalUrl", "pmid", "pmcid",
  "pmcUrl", "preprintDoi", "isOpenAccess", "license", "licenseSource", "summary", "selected",
  "accessions", "updateNotice", "abstract", "csl",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
const PMC_URL = /^https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/$/;
const DATE_PATTERN = /^\d{4}(-\d{2}){0,2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
/** A character reference: titles are stored decoded, so one left in is a value that would render twice-decoded. */
const CHARACTER_REFERENCE = /&(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/;
/** The PreToolUse hook cannot reach data files; escapes keep this file free of the dashes. */
const WIDE_DASH = new RegExp("[\\u2013\\u2014]");
/** A scanned PDF extracts to nothing and everything else still passes. */
const MIN_FULL_TEXT_CHARS = 500;
const SUMMARY_MAX = 200;
/** What `paperAskUrl` may produce before it is a URL no client will send. */
export const ASK_URL_MAX = 600;

/**
 * @typedef {object} PublicationHost
 * @property {(path: string) => Promise<{ size: number, sha256?: string } | null>} pdf the repository file at a
 *   site-absolute public path (`/research/...`), or null when it is not there. `sha256` is present where the
 *   host can hash the bytes (CI); the Worker's GitHub reads cannot, so the hash is checked in CI only.
 *
 * @typedef {object} OtherPublication
 * @property {string} slug
 * @property {string} id
 * @property {string | null} doi
 */

/** @param {unknown} value @returns {value is string} */
const isString = (value) => typeof value === "string";
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** @param {unknown} value @returns {value is string} */
const isFilled = (value) => isString(value) && value.trim() !== "";

/**
 * DOI names are case-insensitive: the one key the corpus joins on.
 *
 * @param {string | null | undefined} doi
 */
export const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

/**
 * @param {object} input
 * @param {import("./parse.mjs").ParsedPublication} input.parsed
 * @param {string} input.slug the file's name without `.md`
 * @param {PublicationHost} input.host
 * @param {OtherPublication[]} [input.others] every OTHER publication, for uniqueness
 * @returns {Promise<string[]>}
 */
export async function validatePublicationFile({ parsed, slug, host, others = [] }) {
  /** @type {string[]} */
  const errors = [...parsed.problems];
  const { data, fullText } = parsed;
  /** @param {string} field @param {string} message */
  const bad = (field, message) => errors.push(`${field}: ${message}`);

  for (const key of Object.keys(data)) {
    if (!FRONT_MATTER_FIELDS.has(key)) bad(key, "is not a publication field");
  }

  // ---- identity: slug, id, DOI, status
  const status = data.status ?? "published";
  if (!STATUSES.includes(/** @type {any} */ (status))) {
    bad("status", `${JSON.stringify(status)} is not one of ${STATUSES.join(", ")}`);
  }
  const submitted = status === "submitted";

  if (!SLUG_PATTERN.test(slug)) {
    bad("slug", `the file name "${slug}" is not a lowercase kebab-case slug`);
  } else if (!contentIdFits(PUBLICATION_KIND, slug)) {
    bad("slug", `"${slug}" is too long: ${PUBLICATION_KIND}.<slug> must fit the 200 characters of a Carrel content id`);
  }
  if (data.slug !== undefined && data.slug !== null && data.slug !== slug) {
    bad("slug", `${JSON.stringify(data.slug)} is not the file's name "${slug}"`);
  }

  const doi = data.doi;
  if (doi === undefined || doi === null) {
    if (!submitted) bad("doi", "is required for a published paper; a manuscript without one is status: submitted");
    if (submitted && data.slug !== slug) bad("slug", "a record with no DOI names its slug in the file (slug: ...), since there is no DOI to derive it from");
  } else if (!isString(doi) || !DOI_PATTERN.test(doi)) {
    bad("doi", `${JSON.stringify(doi)} is not a DOI name (10.<registrant>/<suffix>)`);
  } else if (SLUG_PATTERN.test(slug) && doiSlug(doi) !== slug) {
    bad("doi", `its page slug would be "${doiSlug(doi)}", but the file is named "${slug}". The file name is the DOI's slug and never changes after Google Scholar has indexed it`);
  }

  if (!isFilled(data.id)) {
    bad("id", "is required (the curated id, which is also the BibTeX key)");
  } else if (!isString(data.id) || !ID_PATTERN.test(data.id)) {
    bad("id", `${JSON.stringify(data.id)} must be letters, digits, hyphens and underscores`);
  }

  for (const other of others) {
    if (other.slug === slug) continue;
    if (isString(data.id) && other.id === data.id) bad("id", `"${data.id}" is already the id of ${other.slug}`);
    if (isString(doi) && other.doi && doiKey(other.doi) === doiKey(doi)) {
      bad("doi", `${doi} is already ${other.slug}'s DOI (DOI names are case-insensitive, so two casings are one work)`);
    }
    if (doiSlug(other.doi ?? "") === slug && other.slug !== slug) bad("slug", `the page slug "${slug}" is already ${other.slug}'s`);
  }

  if (data.draft !== undefined && typeof data.draft !== "boolean") bad("draft", "must be true or false");

  // ---- the citation
  if (!isFilled(data.type) || !TYPES.includes(/** @type {any} */ (data.type))) {
    bad("type", `${JSON.stringify(data.type)} is not one of ${TYPES.join(", ")}`);
  }

  const title = data.title;
  if (!isFilled(title)) {
    bad("title", "is required");
  } else if (isString(title)) {
    // paperAskUrl quotes the title and the search reads a quoted run as a phrase, so a quote splits it.
    if (/["']/.test(title)) bad("title", "contains a quotation mark; the paper's Ask link quotes the title, so a quote inside splits the phrase");
    if (CHARACTER_REFERENCE.test(title)) bad("title", "carries a character reference (&amp; and the like); write the character itself");
    if (title.includes("<")) bad("title", "contains \"<\", which would end a JSON-LD script block early");
    if (title !== title.trim() || /\s{2,}/.test(title)) bad("title", "has leading, trailing or repeated whitespace");
  }

  if (!Array.isArray(data.authors) || data.authors.length === 0) {
    bad("authors", "must list at least one author; a shortened list is a wrong citation");
  } else {
    data.authors.forEach((name, i) => {
      if (!isFilled(name)) bad(`authors[${i}]`, "is empty; every author has a name");
    });
  }

  for (const key of ["journal", "volume", "issue", "pages"]) {
    const value = data[key];
    if (value !== undefined && value !== null && !isString(value)) bad(key, "must be text");
    if (isString(value) && value.trim() === "") bad(key, "is blank; leave it out instead");
  }

  const date = data.publishedDate;
  if (date !== undefined && date !== null && !(isString(date) && DATE_PATTERN.test(date))) {
    bad("publishedDate", `${JSON.stringify(date)} is not YYYY-MM-DD, YYYY-MM or YYYY`);
  }
  if (data.year !== undefined && data.year !== null) {
    if (!Number.isInteger(data.year) || /** @type {number} */ (data.year) < 1900 || /** @type {number} */ (data.year) > 2200) {
      bad("year", `${JSON.stringify(data.year)} is not a year`);
    } else if (isString(date) && String(data.year) !== date.slice(0, 4)) {
      bad("year", `${data.year} disagrees with publishedDate ${date}; leave year out, it comes from the date`);
    }
  }
  if ((date === undefined || date === null) && !(Number.isInteger(data.year))) {
    bad("publishedDate", "is required (or year, for a manuscript with no date yet)");
  }

  if (!Array.isArray(data.topics) || data.topics.length === 0) {
    bad("topics", "must carry at least one topic");
  } else {
    data.topics.forEach((topic, i) => {
      if (!isString(topic) || !TOPIC_IDS.has(topic)) bad(`topics[${i}]`, `${JSON.stringify(topic)} is not a declared topic (${[...TOPIC_IDS].join(", ")})`);
    });
  }

  // ---- identifiers
  if (data.pmid !== undefined && data.pmid !== null && !(isString(data.pmid) && /^\d+$/.test(data.pmid))) {
    bad("pmid", `${JSON.stringify(data.pmid)} is not digits`);
  }
  if (data.pmcUrl !== undefined && data.pmcUrl !== null && !(isString(data.pmcUrl) && PMC_URL.test(data.pmcUrl))) {
    bad("pmcUrl", `${JSON.stringify(data.pmcUrl)} is not in landing-page form (https://pmc.ncbi.nlm.nih.gov/articles/PMC<digits>/)`);
  }
  if (Boolean(data.pmcid) !== Boolean(data.pmcUrl)) bad("pmcid", "and pmcUrl are present together or absent together");
  if (data.pmcid !== undefined && data.pmcid !== null && !(isString(data.pmcid) && /^PMC\d+$/.test(data.pmcid))) {
    bad("pmcid", `${JSON.stringify(data.pmcid)} is not PMC<digits>`);
  }
  if (data.preprintDoi !== undefined && data.preprintDoi !== null) {
    if (!isString(data.preprintDoi) || !DOI_PATTERN.test(data.preprintDoi)) bad("preprintDoi", `${JSON.stringify(data.preprintDoi)} is not a DOI name`);
    else if (doiKey(data.preprintDoi) === doiKey(isString(doi) ? doi : "")) bad("preprintDoi", "is the paper's own DOI");
  }
  if (data.isOpenAccess !== undefined && typeof data.isOpenAccess !== "boolean") bad("isOpenAccess", "must be true or false");
  if (data.selected !== undefined && typeof data.selected !== "boolean") bad("selected", "must be true or false");

  // ---- access: where the reader gets the paper
  const access = data.access;
  if (!ACCESS.includes(/** @type {any} */ (access))) {
    bad("access", `${JSON.stringify(access)} is not one of ${ACCESS.join(", ")}`);
  }
  const hasPdfPath = data.pdfPath !== undefined && data.pdfPath !== null;
  if (access === "self-hosted") {
    if (submitted) bad("access", "a submitted manuscript has no PDF on this site; use external");
    const derived = SLUG_PATTERN.test(slug) ? paperPdfPath(slug) : null;
    if (!hasPdfPath) {
      bad("pdfPath", `is required for a self-hosted paper (${derived ?? "the derived path"})`);
    } else if (derived && data.pdfPath !== derived) {
      bad("pdfPath", `${JSON.stringify(data.pdfPath)} should be ${derived}: the PDF lives in its own page's directory, which is what Google Scholar needs`);
    }
    if (data.externalUrl !== undefined && data.externalUrl !== null) bad("externalUrl", "is for external papers; a self-hosted one links its own PDF");
    if (derived && hasPdfPath && data.pdfPath === derived) {
      const file = await host.pdf(derived);
      if (!file) {
        bad("pdfPath", `${derived} is not in the repository at public${derived}. Commit the PDF first; adding one is a git push, never an upload through this tool`);
      } else {
        if (file.size === 0) bad("pdfPath", `${derived} is a zero-byte file`);
        if (!isString(data.pdfSha256) || !SHA256.test(data.pdfSha256)) {
          bad("pdfSha256", "is required for a self-hosted paper: the sha256 of the PDF the full text was extracted from");
        } else if (file.sha256 !== undefined && file.sha256 !== data.pdfSha256) {
          bad("pdfSha256", `${data.pdfSha256.slice(0, 12)} does not match the PDF in the repository (${file.sha256.slice(0, 12)}); re-extract the full text from the current PDF`);
        }
      }
    }
    if (fullText === null) {
      bad("Full text", `a self-hosted paper carries its extracted text under a "## Full text" heading`);
    } else if (fullText.length < MIN_FULL_TEXT_CHARS) {
      bad("Full text", `is ${fullText.length} characters. Extraction produced almost nothing; a scanned PDF with no text layer looks exactly like this`);
    }
  } else if (access === "external") {
    if (hasPdfPath) bad("pdfPath", "is for self-hosted papers; an external one has none");
    if (data.pdfSha256 !== undefined && data.pdfSha256 !== null) bad("pdfSha256", "is for self-hosted papers");
    if (fullText !== null) bad("Full text", "a paper this site does not host has no extracted text");
    const external = data.externalUrl;
    if (external !== undefined && external !== null && !(isString(external) && /^https:\/\/\S+$/.test(external))) {
      bad("externalUrl", `${JSON.stringify(external)} is not an https URL`);
    }
    if (!submitted && !data.externalUrl && !isString(doi)) bad("externalUrl", "an external published paper links out through a DOI or an externalUrl");
  }

  // ---- rights: hosting a paper whose licence does not permit it is Dustin's call, per DOI
  if (access === "self-hosted") {
    const licence = isString(data.license) ? data.license : null;
    if (!permitsRedistribution(licence) && !(isString(doi) && HOSTED_WITHOUT_LICENCE.has(doi))) {
      bad(
        "license",
        `${licence ?? "none"} does not permit redistribution, and ${isString(doi) ? doi : "this paper"} is not one Dustin has chosen to host without one. ` +
          `Hosting a paper whose license does not permit it is Dustin's call, recorded per DOI in app/lib/publications/hosting.mjs, so a new one is a new decision and not a precedent`,
      );
    }
    if (!permitsRedistribution(licence) && !data.licenseSource && licence === null) {
      bad("licenseSource", "a hosted paper with no license records what the registries said (crossref:tdm-only, none-deposited, ...), so a closed paper is not mistaken for an unchecked one");
    }
  }

  // ---- the plain-language line
  if (data.summary !== undefined && data.summary !== null) {
    const summary = data.summary;
    if (!isString(summary) || summary.trim() === "") {
      bad("summary", "is present but blank; absent is a state, empty is a mistake");
    } else {
      if (summary.length > SUMMARY_MAX) bad("summary", `is ${summary.length} characters; the limit is ${SUMMARY_MAX}`);
      if (/[.!?]\s+[A-Z]/.test(summary)) bad("summary", "is more than one sentence");
      if (WIDE_DASH.test(summary)) bad("summary", "carries an em dash or en dash; use a comma, period, parentheses or colon");
    }
  }

  // ---- the abstract and the raw record
  if (data.abstract !== undefined && data.abstract !== null) {
    if (!isString(data.abstract)) bad("abstract", "must be text");
    else if (data.abstract.includes("<")) bad("abstract", `contains "<", which would end a JSON-LD script block early; store it as &lt;`);
  }
  if (data.csl !== undefined && data.csl !== null) {
    if (!isObject(data.csl)) {
      bad("csl", "must be the Crossref record as a mapping");
    } else {
      const cslDoi = data.csl.DOI;
      if (isString(doi) && doiKey(isString(cslDoi) ? cslDoi : "") !== doiKey(doi)) {
        bad("csl.DOI", `${JSON.stringify(cslDoi)} is not this paper's DOI ${doi}`);
      }
      if (isString(data.csl.abstract) && data.csl.abstract.includes("<")) {
        bad("csl.abstract", `contains "<"`);
      }
    }
  }

  // ---- update notice and accessions
  const noticeProblem = updateNoticeProblem(data.updateNotice);
  if (noticeProblem) bad("updateNotice", noticeProblem);

  if (data.accessions !== undefined && data.accessions !== null && !Array.isArray(data.accessions)) {
    bad("accessions", "must be a list of { kind, id }");
  }
  const declared = Array.isArray(data.accessions) ? data.accessions : [];
  declared.forEach((entry, i) => {
    if (!isObject(entry) || !isFilled(entry.kind) || !isFilled(entry.id)) {
      bad(`accessions[${i}]`, "needs a kind and an id");
      return;
    }
    try {
      const url = accessionUrl({ kind: String(entry.kind), id: String(entry.id) });
      if (!url.startsWith("https://www.ncbi.nlm.nih.gov/") || !url.endsWith(String(entry.id))) {
        bad(`accessions[${i}]`, `builds ${url}, which is not an NCBI URL ending in its own id`);
      }
    } catch (error) {
      bad(`accessions[${i}].kind`, error instanceof Error ? error.message : String(error));
    }
  });
  // Both directions: the statement in the paper, not a bare regex, decides what this paper deposited.
  if (access === "self-hosted" && fullText !== null) {
    const flat = (/** @type {Array<{ kind?: unknown, id?: unknown }>} */ list) =>
      list.map((a) => `${a.kind}:${a.id}`).sort().join(",");
    const found = accessionsInText([fullText]);
    if (flat(found) !== flat(declared.filter(isObject))) {
      bad(
        "accessions",
        `the data-availability statement in the PDF names [${flat(found)}] but the file lists [${flat(declared.filter(isObject))}]. ` +
          `The text decides; a bare accession regex returns the comparison organisms' deposits, so only the statement counts`,
      );
    }
  } else if (declared.length > 0) {
    bad("accessions", "an accession is read from the paper's own data-availability statement, which only a hosted PDF's text carries");
  }

  return errors;
}

/**
 * The corpus-level checks the per-file rules cannot see: duplicates across files. CI calls this over
 * every file; the Worker's save passes `others` to the per-file rule instead.
 *
 * @param {Array<{ file: string, slug: string, id: unknown, doi: unknown }>} files
 * @returns {string[]}
 */
export function validateCorpus(files) {
  /** @type {string[]} */
  const errors = [];
  /** @param {string} label @param {(f: typeof files[number]) => string | null} key */
  const unique = (label, key) => {
    /** @type {Map<string, string>} */
    const seen = new Map();
    for (const f of files) {
      const k = key(f);
      if (!k) continue;
      const first = seen.get(k);
      if (first) errors.push(`${f.file}: ${label} "${k}" is also ${first}'s`);
      else seen.set(k, f.file);
    }
  };
  unique("id", (f) => (isString(f.id) ? f.id : null));
  unique("DOI (case-folded)", (f) => (isString(f.doi) ? doiKey(f.doi) : null));
  unique("page slug", (f) => f.slug);
  if (files.length === 0) errors.push("no publication files: the corpus is empty, which would publish an empty page");
  return errors;
}
