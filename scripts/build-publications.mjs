/**
 * Generates the publications module from the canonical bibliographic record and the site-only
 * fields keyed by DOI.
 *
 *   npm run build:publications
 *
 * BOUNDARY: deterministic and offline, and the network refresh that produces those two files
 * lives outside this repo. The generated module is a build artifact: the gate imports `generate()`
 * from here and fails when the committed copy has drifted.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "app", "data", "publications.ts");

/**
 * DOI names are case-insensitive per the spec. Store as deposited, compare casefolded: a raw
 * join silently drops records rather than throwing.
 */
/** @param {string | null | undefined} doi */
const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

/*
 * Punctuation that never takes a space BEFORE it, and brackets that never take one after. Two
 * explicit classes rather than one clever pattern: they are different facts about typography.
 */
const SPACE_BEFORE_PUNCTUATION = /\s+([,;:.)\]])/g;
const SPACE_AFTER_OPENING = /([([])\s+/g;

/**
 * Registry markup reduced to plain text.
 *
 * THE SPACE IS NOT OPTIONAL AND NEITHER IS CLEANING UP AFTER IT. Tags become a SPACE rather than
 * nothing, an earlier import having welded two words together. The cost is a space that was never
 * in the rendered text, which several titles carry, italicized organism names sitting inside
 * parentheses, and a title differing by a space may not match in Google Scholar. So the space is
 * inserted, whitespace collapsed, then the space removed from the two places typography never
 * puts one. The order matters: collapsing first means the cleanup sees a single space.
 *
 * @param {string | null | undefined} value
 */
const clean = (value) =>
  (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(SPACE_BEFORE_PUNCTUATION, "$1")
    .replace(SPACE_AFTER_OPENING, "$1")
    .trim();

/** TS string literal or null. JSON string syntax is valid TS. */
/** @param {unknown} value @returns {string} */
const str = (value) =>
  value === null || value === undefined || value === ""
    ? "null"
    : JSON.stringify(String(value));

/** @param {string[] | null | undefined} items */
const arr = (items) =>
  !items || items.length === 0
    ? "[]"
    : `[${items.map((i) => JSON.stringify(i)).join(", ")}]`;

/** @param {any} value */
const first = (value) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

/** The date fields CSL may carry, in the order of authority this corpus uses. */
const DATE_KEYS = ["published-print", "issued", "published"];

/** @param {any} record @returns {number | null} */
function cslYear(record) {
  for (const key of DATE_KEYS) {
    const parts = record[key]?.["date-parts"]?.[0];
    if (parts && parts[0]) return Number(parts[0]);
  }
  return null;
}

/**
 * The publication date at WHATEVER PRECISION the registry deposited, separate from the year, which
 * stays the thing the page groups by. Padding would invent a day for month-only records and taking
 * the year would throw one away for most; emitting the deposited precision asserts nothing extra.
 *
 * @param {any} record @returns {string | null}
 */
function cslDate(record) {
  for (const key of DATE_KEYS) {
    const parts = record[key]?.["date-parts"]?.[0];
    if (!parts || !parts[0]) continue;
    const [y, m, d] = parts;
    const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
    if (d) return `${y}-${pad(m)}-${pad(d)}`;
    if (m) return `${y}-${pad(m)}`;
    return String(y);
  }
  return null;
}

/*
 * A page range, written as an escape rather than as the characters: this repo's hook refuses the
 * literal wide one, and an invisible-width character in a class is unreviewable.
 */
const PAGE_RANGE = new RegExp("^(\\d+)\\s*[-\\u2013]\\s*(\\d+)$");

/**
 * A page value split into first and last, ONLY when it really is a page range. THE TRAP, AND IT IS
 * IN THIS CORPUS: some records carry an ARTICLE NUMBER rather than pagination, and a split is safe
 * on today's only because they contain no separator. Written as a positive match on the shape, so
 * a future article number carrying one cannot be read as a range.
 *
 * @param {string | null | undefined} page
 * @returns {{ first: string | null, last: string | null }}
 */
function pageRange(page) {
  const value = (page ?? "").trim();
  const range = PAGE_RANGE.exec(value);
  if (range) return { first: range[1] ?? null, last: range[2] ?? null };
  if (/^\d+$/.test(value)) return { first: value, last: null };
  return { first: null, last: null };
}

/** @param {any} record @returns {string[]} */
function cslAuthors(record) {
  return (record.author ?? [])
    .map((/** @type {any} */ a) =>
      [a.given, a.family].filter(Boolean).join(" ") || a.literal || a.name || "",
    )
    .filter(Boolean);
}

const PRELUDE = `/**
 * Publication record for the CV and publications surfaces.
 *
 * Structured content edited by commit, following phage-hunters.ts. PDFs are committed under
 * public/publications/ and served as static assets, which cost the Worker bundle nothing.
 *
 * Every record carries \`access\` even though most are self-hosted, so one can be switched to an
 * external link without a schema change. Year is the Crossref published-print year, which is
 * authoritative here and disagrees with ORCID on some records.
 */

export type TopicId =
  | "human-simian-retroviruses"
  | "avian-retroviruses"
  | "bacteriophages"
  | "science-education";

export type PublicationType =
  | "article"
  | "review"
  | "chapter"
  | "abstract"
  | "teaching-resource";

export type Access = "self-hosted" | "external";

export type Topic = {
  id: TopicId;
  label: string;
  description: string;
};

export type Publication = {
  id: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: number;
  /**
   * The deposited date at its own precision: YYYY-MM-DD, YYYY-MM or YYYY. \`year\` stays the grouping
   * key; this is what \`citation_publication_date\` needs.
   */
  publishedDate: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  /** Set only where \`pages\` is genuinely a range or a first page. */
  firstPage: string | null;
  lastPage: string | null;
  doi: string;
  pmid: string | null;
  pmcid: string | null;
  pmcUrl: string | null;
  type: PublicationType;
  topics: TopicId[];
  access: Access;
  /** Set when access is "self-hosted". */
  pdfPath: string | null;
  /** Set when access is "external". */
  externalUrl: string | null;
  /** Preprint of this record, where one exists. */
  preprintDoi: string | null;
  isOpenAccess: boolean;
  license: string | null;
  /**
   * WHICH registry said so, and at what content-version. \`crossref:tdm-only\`
   * is a measured answer and not an absence: it means the publisher deposited
   * terms and they were text-mining terms, which license redistribution to
   * nobody. A null means no terms were found at either registry.
   */
  licenseSource: string | null;
  /**
   * A PLAIN-LANGUAGE LINE, written by hand, or null.
   *
   * One sentence, under 200 characters, saying what the paper found in words a non-specialist reads.
   * NOT a summary of the abstract, which is already on the page.
   *
   * Null until one is written, and the page renders it only where it exists, so an empty field is a
   * state rather than a gap. \`check:publications\` enforces the length, the single sentence and the
   * house dash rule; IT CANNOT ENFORCE THAT THE SENTENCE IS ANY GOOD.
   */
  summary: string | null;
  /**
   * A RETRACTION, CORRECTION OR EXPRESSION OF CONCERN, or null.
   *
   * Null on every record. The field exists so that the day one arrives is a data change and not a code
   * change, which is the day nobody wants to be writing this. \`doi\` is the NOTICE's DOI: a paper
   * carries \`updated-by\` pointing at the notice, and the notice carries \`update-to\` pointing back.
   *
   * The shape and the sentence belong to \`app/lib/publications/update-notice.mjs\`, which
   * \`check:publications\` validates every record through.
   */
  updateNotice: {
    type: "retraction" | "correction" | "expression-of-concern";
    doi: string;
    date: string | null;
  } | null;
  /**
   * SEQUENCE ACCESSIONS THIS PAPER DEPOSITED, read from its own data-availability statement and from
   * nowhere else.
   *
   * A bare accession regex over a PDF returns the COMPARISON organisms' deposits, which is a wrong
   * citation rather than a missing one: the grounds are on \`app/lib/publications/accessions.mjs\`.
   * \`check:publications\` reconciles this against the extracted text in both directions.
   */
  accessions: { kind: string; id: string }[];
  selected: boolean;
  abstract: string | null;
};
`;

const TOPICS = [
  {
    id: "human-simian-retroviruses",
    label: "Human and simian retroviruses",
    description:
      "HTLV-1 accessory proteins and how related retroviruses establish infection and persistence",
  },
  {
    id: "avian-retroviruses",
    label: "Avian retroviruses",
    description:
      "Reticuloendotheliosis virus and related retroviruses in wild bird populations",
  },
  {
    id: "bacteriophages",
    label: "Bacteriophages",
    description: "Phage genomics with undergraduate researchers",
  },
  {
    id: "science-education",
    label: "Science education",
    description:
      "Turning coursework into real research, and public attitudes toward science",
  },
];

export function generate() {
  const csl = JSON.parse(
    readFileSync(join(ROOT, "data", "publications.csl.json"), "utf8"),
  );
  const site = JSON.parse(
    readFileSync(join(ROOT, "data", "publications.site.json"), "utf8"),
  );

  /** @type {Map<string, any>} */
  const cslByDoi = new Map();
  for (const record of csl) {
    const key = doiKey(record.DOI ?? record.id);
    if (cslByDoi.has(key)) {
      throw new Error(`duplicate DOI after casefolding: ${record.DOI}`);
    }
    cslByDoi.set(key, record);
  }

  /** @type {any[]} */
  const rows = [];
  for (const [doi, siteFields] of Object.entries(site)) {
    const record = cslByDoi.get(doiKey(doi));
    if (!record) throw new Error(`no CSL record for DOI ${doi}`);
    rows.push({
      // DOI is emitted from the site key, as deposited, not from the CSL
      // payload, which Crossref lowercases as a display convention.
      doi,
      title: clean(first(record.title)),
      authors: cslAuthors(record),
      journal: clean(first(record["container-title"])) || null,
      year: cslYear(record),
      publishedDate: cslDate(record),
      volume: record.volume ?? null,
      issue: record.issue ?? null,
      pages: record.page ?? null,
      ...(() => {
        const { first, last } = pageRange(record.page);
        return { firstPage: first, lastPage: last };
      })(),
      abstract: record.abstract ?? null,
      ...siteFields,
    });
  }

  rows.sort((/** @type {any} */ a, /** @type {any} */ b) => {
    if (b.year !== a.year) return b.year - a.year;
    const x = a.title.toLowerCase();
    const y = b.title.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });

  const lines = [PRELUDE, "export const TOPICS: Topic[] = ["];
  for (const t of TOPICS) {
    lines.push("  {");
    lines.push(`    id: ${str(t.id)},`);
    lines.push(`    label: ${str(t.label)},`);
    lines.push(`    description: ${str(t.description)},`);
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  lines.push("/** Newest first. */");
  lines.push("export const PUBLICATIONS: Publication[] = [");
  for (const r of rows) {
    lines.push("  {");
    lines.push(`    id: ${str(r.id)},`);
    lines.push(`    title: ${str(r.title)},`);
    lines.push(`    authors: ${arr(r.authors)},`);
    lines.push(`    journal: ${str(r.journal)},`);
    lines.push(`    year: ${r.year === null ? "null" : String(r.year)},`);
    lines.push(`    publishedDate: ${str(r.publishedDate)},`);
    lines.push(`    volume: ${str(r.volume)},`);
    lines.push(`    issue: ${str(r.issue)},`);
    lines.push(`    pages: ${str(r.pages)},`);
    lines.push(`    firstPage: ${str(r.firstPage)},`);
    lines.push(`    lastPage: ${str(r.lastPage)},`);
    lines.push(`    doi: ${str(r.doi)},`);
    lines.push(`    pmid: ${str(r.pmid)},`);
    lines.push(`    pmcid: ${str(r.pmcid)},`);
    lines.push(`    pmcUrl: ${str(r.pmcUrl)},`);
    lines.push(`    type: ${str(r.type)},`);
    lines.push(`    topics: ${arr(r.topics)},`);
    lines.push(`    access: ${str(r.access)},`);
    lines.push(`    pdfPath: ${str(r.pdfPath)},`);
    lines.push(`    externalUrl: ${str(r.externalUrl)},`);
    lines.push(`    preprintDoi: ${str(r.preprintDoi)},`);
    lines.push(`    isOpenAccess: ${r.isOpenAccess ? "true" : "false"},`);
    lines.push(`    license: ${str(r.license)},`);
    lines.push(`    licenseSource: ${str(r.licenseSource)},`);
    lines.push(`    summary: ${str(r.summary)},`);
    /*
     * EMITTED AS JSON, not field by field: a per-field emitter would be a second statement of the
     * shape another module owns.
     */
    lines.push(
      `    updateNotice: ${r.updateNotice ? JSON.stringify(r.updateNotice) : "null"},`,
    );
    lines.push(
      `    accessions: ${r.accessions ? JSON.stringify(r.accessions) : "[]"},`,
    );
    lines.push(`    selected: ${r.selected ? "true" : "false"},`);
    lines.push(`    abstract: ${str(r.abstract)},`);
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

/*
 * WRITES ONLY WHEN RUN DIRECTLY, and the gate's import is the reason: the bottom of this file used
 * to write at module scope, so importing it would have rewritten the very file the comparison was
 * about, and the gate would pass by repairing its own subject.
 */
if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  const emitted = generate();
  writeFileSync(OUT_PATH, emitted, "utf8");
  console.log(`wrote app/data/publications.ts (${emitted.length} bytes)`);
}
