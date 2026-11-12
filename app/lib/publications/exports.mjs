// Pure functions of the committed corpus (no clock, no citation count), so check:machine-readable can
// compare bytes and two downloads match. Author names go through `canonicalAuthor` in authors.mjs.

import { ORGANISM_PATTERN } from "../../data/organisms.ts";
import { canonicalAuthor } from "./authors.mjs";
import { decodeEntities } from "./entities.mjs";
import { toBibtex, toRis } from "@drdustinedwards/site-helpers/scholar";
import { SITE_ORIGIN } from "../site-origin.mjs";

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

/**
 * One paper as a RIS record, by the same alias table.
 *
 * @param {any} paper
 */
export function paperRis(paper) {
  return toRis(paper, CITATION_OPTIONS);
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
  return `${header("", papers.length)}\n${papers.map(paperRis).join("\n\n")}\n`;
}
