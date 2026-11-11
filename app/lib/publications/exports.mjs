// Pure functions of the committed corpus (no clock, no citation count), so check:machine-readable can
// compare bytes and two downloads match. Author names go through `canonicalAuthor` in authors.mjs.

import { ORGANISM_PATTERN } from "../../data/organisms.ts";
import { canonicalAuthor } from "./authors.mjs";
import { decodeEntities } from "./entities.mjs";
import { toBibtex } from "@drdustinedwards/site-helpers/scholar";
import { SITE_ORIGIN } from "../site-origin.mjs";

export { canonicalAuthor };

/**
 * Best effort; the CSL export does not use this, it reads the structured given and family fields.
 *
 * @param {string} name
 */
function splitName(name) {
  const parts = canonicalAuthor(name).split(" ").filter(Boolean);
  if (parts.length < 2) return { family: parts[0] ?? "", given: "" };
  return {
    family: parts[parts.length - 1] ?? "",
    given: parts.slice(0, -1).join(" "),
  };
}

/**
 * For check:machine-readable. A substring test is wrong: Mycobacterium smegmatis contains the bare
 * genus, which the matcher correctly never braces.
 *
 * @param {string} text
 * @returns {string[]} each match, in order, with duplicates kept
 */
export function organismsIn(text) {
  return [...String(text ?? "").matchAll(ORGANISM_PATTERN)].map((m) => m[0]);
}

/**
 * What Prelum's ./scholar formats need from this site: its alias table, so one person's spellings export as one name,
 * and the organism names BibTeX styles must not lowercase (a lowercased genus is wrong under the nomenclature codes).
 */
export const CITATION_OPTIONS = { author: canonicalAuthor, protect: ORGANISM_PATTERN };

/**
 * One paper as a BibTeX entry, keyed by the record's curated id: a second key scheme would give one work two identities.
 *
 * @param {any} paper
 */
export function paperBibtex(paper) {
  return toBibtex(paper, CITATION_OPTIONS);
}

// TY first, ER last, exactly two spaces before the dash: reference managers are strict about that.
const RIS_TYPE = {
  article: "JOUR",
  review: "JOUR",
  abstract: "ABST",
  chapter: "CHAP",
  "teaching-resource": "ELEC",
};

/** @param {any} paper */
export function toRis(paper) {
  /** @type {[string, string][]} */
  const rows = [["TY", RIS_TYPE[/** @type {keyof typeof RIS_TYPE} */ (paper.type)] ?? "JOUR"]];
  rows.push(["TI", decodeEntities(paper.title)]);
  for (const name of paper.authors) {
    const { family, given } = splitName(name);
    rows.push(["AU", given ? `${family}, ${given}` : family]);
  }
  if (paper.journal) rows.push(["JO", decodeEntities(paper.journal)]);
  if (paper.year) rows.push(["PY", String(paper.year)]);
  // RIS wants slashes and tolerates a trailing empty field, which is how a partial date is expressed.
  if (paper.publishedDate) rows.push(["DA", paper.publishedDate.replace(/-/g, "/")]);
  if (paper.volume) rows.push(["VL", String(paper.volume)]);
  if (paper.issue) rows.push(["IS", String(paper.issue)]);
  if (paper.firstPage) rows.push(["SP", paper.firstPage]);
  if (paper.lastPage) rows.push(["EP", paper.lastPage]);
  if (paper.abstract) rows.push(["AB", decodeEntities(paper.abstract)]);
  if (paper.doi) {
    rows.push(["DO", paper.doi]);
    rows.push(["UR", `https://doi.org/${paper.doi}`]);
  }
  rows.push(["ER", ""]);
  return rows.map(([tag, value]) => `${tag}  - ${value}`).join("\n");
}

/**
 * A pass-through of the raw Crossref records the publication files carry (`csl`) that only decodes character references (stored escaped
 * for this site's JSON-LD, not for a reference manager). Nothing is added.
 *
 * @param {any[]} cslRecords the `csl` record of each published paper that has one, in the index's order
 */
export function toCslJson(cslRecords) {
  /**
   * The return annotation is required: decodeDeep is recursive, and TypeScript refuses it with TS7023.
   *
   * @param {any} value
   * @returns {any}
   */
  const decodeDeep = (value) => {
    if (typeof value === "string") return decodeEntities(value);
    if (Array.isArray(value)) return value.map(decodeDeep);
    if (value && typeof value === "object") {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = decodeDeep(v);
      return out;
    }
    return value;
  };
  return `${JSON.stringify(cslRecords.map(decodeDeep), null, 2)}\n`;
}

/**
 * No generation timestamp: two downloads of an unchanged corpus must be byte-identical.
 *
 * @param {string} comment the format's line-comment prefix
 * @param {number} count
 */
function header(comment, count) {
  return [
    `${comment} ${count} works by Dustin Edwards.`,
    `${comment} Generated from ${SITE_ORIGIN}/research/publications`,
    `${comment} Bibliographic data from Crossref and DataCite. No generation date:`,
    `${comment} this file is a function of the corpus, so it changes only when the`,
    `${comment} corpus does.`,
    "",
  ].join("\n");
}

/** @param {any[]} papers */
export function toBibtexAll(papers) {
  return `${header("%", papers.length)}\n${papers.map(paperBibtex).join("\n\n")}\n`;
}

/** @param {any[]} papers */
export function toRisAll(papers) {
  return `${header("", papers.length)}\n${papers.map(toRis).join("\n\n")}\n`;
}
