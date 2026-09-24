/**
 * BibTeX, RIS and CSL JSON for the corpus, and for one paper.
 *
 * ## DETERMINISTIC, WHICH IS THE WHOLE CONTRACT
 *
 * Every function here is a pure function of the committed corpus. No clock, no
 * request, no network, no citation count. That is what lets `check:machine-readable`
 * generate twice and compare bytes, and it is why the citation count is
 * deliberately absent from the exports even though the page shows it: a count
 * moves without a deploy, and an export that changed between two downloads of
 * the same URL would be a citation record that cannot be cited.
 *
 * ## ONE DISPLAY FORM PER AUTHOR
 *
 * The registries return the owner three ways across this corpus: "Dustin
 * Edwards" on 28 records, "Dustin C. Edwards" on 7 and "Dustin Cole Edwards" on
 * 1. A reference manager treats those as three people, which is exactly the
 * disambiguation failure the site's Person node exists to prevent, arriving
 * through the export instead.
 *
 * The alias table is SMALL AND EXPLICIT rather than a rule. A rule of the shape
 * "same surname, same first initial" would fold "Julie Edwards", who is a
 * different person and appears on 4 records, into the owner. That is not a
 * hypothetical edge: she is in the data.
 */

import { ORGANISMS } from "../../data/organisms.ts";
import { decodeEntities } from "./entities.mjs";

/**
 * Registry spellings to the one form exports use.
 *
 * Keys are exact strings measured in the corpus, not patterns. Adding a
 * spelling means seeing it in the data first.
 */
const AUTHOR_ALIASES = new Map([
  ["Dustin C. Edwards", "Dustin Edwards"],
  ["Dustin Cole Edwards", "Dustin Edwards"],
]);

/** @param {string} name */
export function canonicalAuthor(name) {
  const clean = decodeEntities(name).replace(/\s+/g, " ").trim();
  return AUTHOR_ALIASES.get(clean) ?? clean;
}

/**
 * "Given Family" split into BibTeX's "Family, Given".
 *
 * Best effort and it says so: a single token is returned as-is (an institution
 * or a mononym), and everything before the last token is the given part. There
 * is no correct general algorithm for this, which is why CSL carries `given`
 * and `family` separately and why the CSL export below does NOT go through this
 * function: it reads the structured fields straight from the source record.
 *
 * @param {string} name
 */
export function splitName(name) {
  const parts = canonicalAuthor(name).split(" ").filter(Boolean);
  if (parts.length < 2) return { family: parts[0] ?? "", given: "" };
  /*
   * `?? ""` rather than an assertion. The guard above proves the array is not
   * empty, and `noUncheckedIndexedAccess` still types the read as possibly
   * undefined; an assertion is the one spelling that cannot be wrong at compile
   * time and can be wrong at runtime, and this function's input is registry
   * data.
   */
  return {
    family: parts[parts.length - 1] ?? "",
    given: parts.slice(0, -1).join(" "),
  };
}

/* ------------------------------------------------------------------ BibTeX */

/**
 * BibTeX special characters, escaped.
 *
 * The backslash goes FIRST or it escapes the escapes that follow it. Braces are
 * escaped here and applied deliberately by `protectOrganisms` afterwards, which
 * is why that function runs on the already-escaped string.
 */
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

/*
 * Organisms, longest first, so a trinomial wins over the binomial inside it.
 * The list is imported rather than restated; it is the same allowlist the page
 * italicizes from, and a second copy would be a second answer to "what is an
 * organism name here".
 */
const ORGANISM_PATTERN = new RegExp(
  `(${ORGANISMS.map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "g",
);

/**
 * Wrap organism names in braces so BibTeX cannot lowercase them.
 *
 * ## WHY THIS IS NOT COSMETIC
 *
 * Many BibTeX styles (`plain`, `abbrv`, `unsrt`, and most numeric styles)
 * TITLECASE or lowercase a title. `Meleagris gallopavo` comes out as
 * `Meleagris gallopavo` in some and `meleagris gallopavo` in others, and a
 * lowercased genus is not a formatting preference, it is wrong: the capital is
 * part of the name under the nomenclature codes.
 *
 * Braces tell BibTeX to leave the enclosed text exactly as written. Applied
 * AFTER escaping, because escaping would otherwise turn these braces into
 * literal `\{` and the protection would become visible punctuation.
 *
 * @param {string} escaped a string already through `escapeBibtex`
 */
export function protectOrganisms(escaped) {
  return escaped.replace(ORGANISM_PATTERN, "{$1}");
}

/**
 * The organism names a string actually CONTAINS, by the same longest-first rule
 * `protectOrganisms` applies.
 *
 * Exported for `check:machine-readable`, and the reason is a bug that gate caught in
 * its own first draft. The obvious assertion is
 * `ORGANISMS.filter((o) => title.includes(o))`, and it is wrong: a title
 * carrying "Mycobacterium smegmatis" also contains the bare genus
 * "Mycobacterium" as a substring, so a substring test demands a `{Mycobacterium}`
 * brace that the matcher correctly never produces, and five records failed a
 * gate whose subject was fine.
 *
 * A gate must ask the question the code answers. This is that question.
 *
 * @param {string} text
 * @returns {string[]} each match, in order, with duplicates kept
 */
export function organismsIn(text) {
  return [...String(text ?? "").matchAll(ORGANISM_PATTERN)].map((m) => m[0]);
}

/**
 * The BibTeX entry type for a record's curated type.
 *
 * `@misc` for a teaching resource rather than `@electronic`: `@misc` is in the
 * standard styles and `@electronic` is not, so the second would render as
 * nothing at all in the styles most people have.
 */
const BIBTEX_TYPE = {
  article: "article",
  review: "article",
  abstract: "inproceedings",
  chapter: "incollection",
  "teaching-resource": "misc",
};

/**
 * One BibTeX entry.
 *
 * The citation key is the record's own curated id. It is already unique, already
 * stable, already the thing the URL and the filename were derived from, and
 * inventing a second key scheme would be a second identity for one work.
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
    // `booktitle` for a chapter, which is what `@incollection` reads.
    const key = type === "incollection" ? "booktitle" : "journal";
    lines.push(field(key, protectOrganisms(escapeBibtex(paper.journal))));
  }
  if (paper.year) lines.push(field("year", String(paper.year)));
  if (paper.volume) lines.push(field("volume", escapeBibtex(String(paper.volume))));
  if (paper.issue) lines.push(field("number", escapeBibtex(String(paper.issue))));
  // `pages` VERBATIM from the record, not rebuilt from first and last. The two
  // article-number records (e1004454, e42123) have no first page, and a field
  // rebuilt from parts would silently drop them.
  if (paper.pages) lines.push(field("pages", escapeBibtex(String(paper.pages))));
  // AS DEPOSITED. DOI names are case-insensitive, and six in this corpus are
  // mixed case; lowercasing here would make the export disagree with the
  // registry it came from for no gain.
  lines.push(field("doi", paper.doi));
  lines.push(field("url", `https://doi.org/${paper.doi}`));
  lines.push("}");
  return lines.join("\n");
}

/* --------------------------------------------------------------------- RIS */

/**
 * RIS type tags.
 *
 * `TY` must be first and `ER` must be last; everything between is
 * `XX  - value` with exactly two spaces before the dash. Reference managers are
 * strict about that spacing and forgiving about almost nothing else.
 */
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
  // AU per author, "Family, Given", which is what RIS specifies.
  for (const name of paper.authors) {
    const { family, given } = splitName(name);
    rows.push(["AU", given ? `${family}, ${given}` : family]);
  }
  if (paper.journal) rows.push(["JO", decodeEntities(paper.journal)]);
  if (paper.year) rows.push(["PY", String(paper.year)]);
  // `DA` carries the full date where one was deposited. RIS wants slashes and
  // tolerates a trailing empty field, which is how a partial date is expressed.
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

/* ---------------------------------------------------------------- CSL JSON */

/**
 * CSL JSON, from the canonical record rather than rebuilt from the page's view.
 *
 * `data/publications.csl.json` IS CSL JSON: it is the assembled canonical
 * bibliographic record, and rebuilding one from `publications.ts` would be a
 * second, worse derivation of something the repo already holds. So this is a
 * pass-through with exactly two transformations, and both are stated because a
 * pass-through that quietly changes things is the worst of both.
 *
 *   Character references are DECODED. The stored form keeps them escaped so a
 *   registry string is safe in the JSON-LD block, which is a property of THIS
 *   SITE's markup and not of the bibliographic record. A reference manager
 *   importing `p &lt; 0.05` would show those characters to a reader.
 *
 *   Nothing is added. No citation count, no OA badge, no site URL. This file is
 *   what the registries say, and a downstream consumer that wanted this site's
 *   opinion would not be asking for CSL.
 *
 * @param {any[]} cslRecords the parsed contents of data/publications.csl.json
 */
export function toCslJson(cslRecords) {
  /**
   * The return annotation is required, not decorative: this function is
   * recursive, so without it TypeScript cannot infer a type for the expression
   * that references it and refuses with TS7023.
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

/* ------------------------------------------------------------- whole lists */

/**
 * The file header every export carries.
 *
 * NO GENERATION TIMESTAMP, and that is the deliberate part. A timestamp would
 * make two downloads of the same unchanged corpus differ, which defeats the
 * byte comparison `check:machine-readable` makes and, more importantly, makes a
 * saved citation file look modified when nothing about the work changed.
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
  /*
   * Blank-line separated. The RIS spec ends each record with `ER  -` and most
   * parsers accept records run together, but a blank line between them is what
   * every reference manager emits and is what makes the file readable by eye
   * when somebody is working out why an import went wrong.
   */
  return `${header("", papers.length)}\n${papers.map(toRis).join("\n\n")}\n`;
}
