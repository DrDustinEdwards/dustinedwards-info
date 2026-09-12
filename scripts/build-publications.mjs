/**
 * Generates app/data/publications.ts from the two source files.
 *
 * Inputs:
 *   data/publications.csl.json   canonical CSL-JSON, the bibliographic record
 *   data/publications.site.json  site-only fields, keyed by DOI as deposited
 *
 * Deterministic and offline. The network refresh that produces those two files
 * lives outside this repo in pubs-pipeline/assemble.py.
 *
 * Run: npm run build:publications
 *
 * app/data/publications.ts is a build artifact. Do not hand-edit it.
 * `npm run check:publications` imports `generate()` from here and fails if the
 * committed module has drifted from a fresh generation, along with the rest of
 * the corpus assertions. That gate used to be this file's `--check` flag; it
 * moved out when it grew past one comparison.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "app", "data", "publications.ts");

/**
 * DOI names are case-insensitive per the DOI spec, which folds ASCII case for
 * comparison. Store as deposited, compare casefolded. A raw-string join here
 * silently drops records rather than throwing.
 */
/** @param {string | null | undefined} doi */
const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

/** @param {string | null | undefined} value */
const clean = (value) =>
  (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
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

/** @param {any} record @returns {number | null} */
function cslYear(record) {
  for (const key of ["published-print", "issued", "published"]) {
    const parts = record[key]?.["date-parts"]?.[0];
    if (parts && parts[0]) return Number(parts[0]);
  }
  return null;
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
 * Structured content edited by commit, so it lives here rather than in the D1
 * \`posts\` table, following the precedent set by phage-hunters.ts. PDFs are
 * committed under public/publications/ and served as static assets, which are
 * a separate limit from the Worker script size and so cost the bundle nothing.
 *
 * Every record carries \`access\` even though most are self-hosted, so a single
 * publication can be switched to an external link without a schema change.
 * Year is the Crossref published-print year, which is authoritative here and
 * disagrees with ORCID on four records.
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
  volume: string | null;
  issue: string | null;
  pages: string | null;
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
      volume: record.volume ?? null,
      issue: record.issue ?? null,
      pages: record.page ?? null,
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
    lines.push(`    volume: ${str(r.volume)},`);
    lines.push(`    issue: ${str(r.issue)},`);
    lines.push(`    pages: ${str(r.pages)},`);
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
    lines.push(`    selected: ${r.selected ? "true" : "false"},`);
    lines.push(`    abstract: ${str(r.abstract)},`);
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

/*
 * WRITES ONLY WHEN RUN DIRECTLY, since 2026-09-12.
 *
 * `--check` moved out to `scripts/check-publications.mjs`, which imports
 * `generate()` and compares. That import is the reason for this guard: the
 * bottom of this file used to call `generate()` and then WRITE at module scope,
 * so importing it for the comparison would have rewritten the very file the
 * comparison was about, and the gate would have passed by repairing its own
 * subject before looking at it. A gate that cannot fail is the tenth vacuity
 * class, reached here through an import rather than through an assertion.
 *
 * `process.argv[1]` rather than an `import.meta.main` check, which Node does
 * not have at the version this repo pins.
 */
if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  const emitted = generate();
  writeFileSync(OUT_PATH, emitted, "utf8");
  console.log(`wrote app/data/publications.ts (${emitted.length} bytes)`);
}
