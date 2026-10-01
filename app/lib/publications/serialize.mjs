// Writes a publication file: the front matter in one fixed key order, every string double quoted (YAML's
// double-quoted style is a superset of JSON strings, so JSON.stringify is the escaper and no value can be
// read back as a date, a boolean or a number it was not). Used by the one-time migration, by the PDF text
// extractor, which rewrites a file's Full text section in place, and by the tests.

import { FULL_TEXT_HEADING } from "./parse.mjs";

/** Canonical order. A key not listed here is a key the validator refuses. */
const FRONT_MATTER_KEYS = [
  "doi",
  "slug",
  "id",
  "status",
  "draft",
  "type",
  "title",
  "authors",
  "journal",
  "publishedDate",
  "year",
  "volume",
  "issue",
  "pages",
  "topics",
  "access",
  "pdfPath",
  "pdfSha256",
  "externalUrl",
  "pmid",
  "pmcid",
  "pmcUrl",
  "preprintDoi",
  "isOpenAccess",
  "license",
  "licenseSource",
  "summary",
  "selected",
  "accessions",
  "updateNotice",
  "abstract",
  "csl",
];

const PLAIN_KEY = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** @param {unknown} value */
const isScalar = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);

/** @param {unknown} value */
function scalar(value) {
  if (value === null) return "null";
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** @param {string} key */
const keyText = (key) => (PLAIN_KEY.test(key) ? key : JSON.stringify(key));

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} indent
 * @returns {string[]}
 */
function entry(key, value, indent) {
  const pad = " ".repeat(indent);
  const k = keyText(key);
  if (isScalar(value)) return [`${pad}${k}: ${scalar(value)}`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${k}: []`];
    if (value.every(isScalar)) return [`${pad}${k}:`, ...value.map((v) => `${pad}  - ${scalar(v)}`)];
    if (value.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
      return [
        `${pad}${k}:`,
        ...value.flatMap((item) => {
          const lines = block(/** @type {Record<string, unknown>} */ (item), indent + 4);
          if (lines.length === 0) return [`${pad}  - {}`];
          // The first line of the mapping rides on the dash: "- " is the two columns the indent gained.
          return [`${pad}  - ${(lines[0] ?? "").slice(indent + 4)}`, ...lines.slice(1)];
        }),
      ];
    }
    // Arrays of arrays (a date-parts triple): one line of flow style, which is JSON.
    return [`${pad}${k}: ${JSON.stringify(value)}`];
  }
  const lines = block(/** @type {Record<string, unknown>} */ (value), indent + 2);
  return lines.length === 0 ? [`${pad}${k}: {}`] : [`${pad}${k}:`, ...lines];
}

/**
 * @param {Record<string, unknown>} object
 * @param {number} indent
 * @returns {string[]}
 */
function block(object, indent) {
  return Object.entries(object).flatMap(([key, value]) => (value === undefined ? [] : entry(key, value, indent)));
}

/**
 * @param {Record<string, unknown>} data front matter fields; null and undefined values are left out
 * @param {string | null} fullText the extracted text, or null for a file with no Full text section
 * @returns {string}
 */
export function renderPublicationFile(data, fullText) {
  const known = new Set(FRONT_MATTER_KEYS);
  const unknown = Object.keys(data).filter((key) => !known.has(key));
  if (unknown.length > 0) throw new Error(`renderPublicationFile: not front matter fields: ${unknown.join(", ")}`);
  const lines = FRONT_MATTER_KEYS.flatMap((key) => {
    const value = data[key];
    return value === null || value === undefined ? [] : entry(key, value, 0);
  });
  const head = ["---", ...lines, "---", ""].join("\n");
  return fullText === null ? head : `${head}\n${FULL_TEXT_HEADING}\n\n${fullText}\n`;
}
