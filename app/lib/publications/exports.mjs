// Pure functions of the committed corpus (no clock, no citation count), so check:machine-readable can
// compare bytes and two downloads match. Author names go through `canonicalAuthor` in authors.mjs.

import { ORGANISMS } from "../../data/organisms.ts";
import { canonicalAuthor } from "./authors.mjs";
import { decodeEntities } from "./entities.mjs";

export { canonicalAuthor };

/**
 * Best effort; the CSL export does not use this, it reads the structured given and family fields.
 *
 * @param {string} name
 */
export function splitName(name) {
  const parts = canonicalAuthor(name).split(" ").filter(Boolean);
  if (parts.length < 2) return { family: parts[0] ?? "", given: "" };
  return {
    family: parts[parts.length - 1] ?? "",
    given: parts.slice(0, -1).join(" "),
  };
}

// The backslash goes first, or it escapes the escapes that follow it.
/** @type {[string, string][]} */
const BIBTEX_ESCAPES = [
  ["\\", "\\textbackslash{}"],
  ["{", "\\{"],
  ["}", "\\}"],
  ["&", "\\&"],
  ["%", "\\%"],
  ["$", "\\$"],
  ["#", "\\#"],
  ["_", "\\_"],
  ["~", "\\textasciitilde{}"],
  ["^", "\\textasciicircum{}"],
];

/** @param {string} value */
function escapeBibtex(value) {
  let out = decodeEntities(value);
  for (const [from, to] of BIBTEX_ESCAPES) out = out.split(from).join(to);
  return out;
}

// Longest first, so a trinomial wins over the binomial inside it.
const ORGANISM_PATTERN = new RegExp(
  `(${ORGANISMS.map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "g",
);

/**
 * Many BibTeX styles lowercase titles, and a lowercased genus is wrong under the nomenclature codes.
 * Applied after escaping, or the braces would be escaped into visible punctuation.
 *
 * @param {string} escaped a string already through `escapeBibtex`
 */
export function protectOrganisms(escaped) {
  return escaped.replace(ORGANISM_PATTERN, "{$1}");
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

// misc, not electronic, which the standard styles render as nothing.
const BIBTEX_TYPE = {
  article: "article",
  review: "article",
  abstract: "inproceedings",
  chapter: "incollection",
  "teaching-resource": "misc",
};

/**
 * The key is the record's curated id: a second key scheme would give one work two identities.
 *
 * @param {any} paper
 */
export function toBibtex(paper) {
  const type = BIBTEX_TYPE[/** @type {keyof typeof BIBTEX_TYPE} */ (paper.type)] ?? "article";
  const field = (/** @type {string} */ k, /** @type {string} */ v) =>
    `  ${k} = {${v}},`;

  const lines = [`@${type}{${paper.id},`];
  lines.push(field("title", protectOrganisms(escapeBibtex(paper.title))));
  lines.push(
    field(
      "author",
      paper.authors
        .map((/** @type {string} */ n) => escapeBibtex(canonicalAuthor(n)))
        .join(" and "),
    ),
  );
  if (paper.journal) {
    const key = type === "incollection" ? "booktitle" : "journal";
    lines.push(field(key, protectOrganisms(escapeBibtex(paper.journal))));
  }
  if (paper.year) lines.push(field("year", String(paper.year)));
  if (paper.volume) lines.push(field("volume", escapeBibtex(String(paper.volume))));
  if (paper.issue) lines.push(field("number", escapeBibtex(String(paper.issue))));
  // Verbatim, not rebuilt from first and last: article-number records have no first page.
  if (paper.pages) lines.push(field("pages", escapeBibtex(String(paper.pages))));
  // As deposited: lowercasing would make the export disagree with the registry.
  lines.push(field("doi", paper.doi));
  lines.push(field("url", `https://doi.org/${paper.doi}`));
  lines.push("}");
  return lines.join("\n");
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
  rows.push(["DO", paper.doi]);
  rows.push(["UR", `https://doi.org/${paper.doi}`]);
  rows.push(["ER", ""]);
  return rows.map(([tag, value]) => `${tag}  - ${value}`).join("\n");
}

/**
 * A pass-through of data/publications.csl.json that only decodes character references (stored escaped
 * for this site's JSON-LD, not for a reference manager). Nothing is added.
 *
 * @param {any[]} cslRecords the parsed contents of data/publications.csl.json
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
    `${comment} Generated from https://dustinedwards.info/publications`,
    `${comment} Bibliographic data from Crossref and DataCite. No generation date:`,
    `${comment} this file is a function of the corpus, so it changes only when the`,
    `${comment} corpus does.`,
    "",
  ].join("\n");
}

/** @param {any[]} papers */
export function toBibtexAll(papers) {
  return `${header("%", papers.length)}\n${papers.map(toBibtex).join("\n\n")}\n`;
}

/** @param {any[]} papers */
export function toRisAll(papers) {
  return `${header("", papers.length)}\n${papers.map(toRis).join("\n\n")}\n`;
}
