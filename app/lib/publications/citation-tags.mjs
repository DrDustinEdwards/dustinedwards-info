/**
 * The Highwire `citation_*` meta tags, which are what puts a paper in Google
 * Scholar.
 *
 * ## WHY THIS IS A MODULE AND NOT A `meta()` BODY
 *
 * Three consumers have to agree about this tag set: the route that emits it,
 * `check:features` which asserts the set per page, and the markdown twin which
 * states the same facts in another form. A tag set assembled inline in `meta()`
 * can only be checked by a gate that re-derives it, and a gate that re-derives
 * its own expectation from the code it checks is the vacuity hard rule 10 names.
 * This builds the list; the gate calls this and asserts over the RESULT.
 *
 * ## THE THREE THAT ARE HARD FAILURES
 *
 * Google Scholar's technical guidelines name the minimum: "the title of the
 * article, the full name of at least the first author, and the year of
 * publication". `citation_title`, `citation_author` and
 * `citation_publication_date`. A page missing any of them is not indexed
 * badly, it is not indexed, so `buildCitationTags` REFUSES rather than emitting
 * a partial set. The alternative is a page that looks finished and is invisible,
 * and the feedback loop on that is six to nine months.
 *
 * ## `citation_pdf_url` AND THE SAME-SUBDIRECTORY RULE
 *
 * Scholar: "For security reasons, it must refer to a file in the same
 * subdirectory as the HTML abstract." That is why the page URL carries a
 * trailing slash and the PDF sits inside it; the grounds are on `paths.mjs`.
 * This module does not construct either path, it takes them, so there is one
 * owner of the pair and this cannot drift from the file the build actually
 * copied.
 *
 * ## ONE TAG PER AUTHOR, NEVER A JOINED STRING
 *
 * Scholar reads repeated `citation_author` tags. A single comma-joined tag is
 * the common mistake and it produces one author whose name is the whole list.
 * This corpus makes that spectacularly visible: one record has 100 authors and
 * another has 144, so the joined form would assert a single person with a
 * 4,000-character name.
 */

import { decodeEntities } from "./entities.mjs";

/**
 * Scholar reads `YYYY/MM/DD`, and accepts a bare year.
 *
 * The corpus stores `YYYY-MM-DD` at whatever precision the registry deposited,
 * so this is a separator swap rather than a reformat, and a partial date stays
 * partial. Emitting `2011/01/01` for a record that only ever said `2011` would
 * be inventing a day on a tag that feeds a citation graph.
 *
 * @param {string | null | undefined} isoish `YYYY-MM-DD`, `YYYY-MM` or `YYYY`
 * @param {number | null | undefined} year fallback when no date was deposited
 * @returns {string | null}
 */
export function scholarDate(isoish, year) {
  const value = (isoish ?? "").trim();
  if (/^\d{4}(-\d{2}){0,2}$/.test(value)) return value.replace(/-/g, "/");
  return year ? String(year) : null;
}

/**
 * @typedef {object} CitationTag
 * @property {string} name
 * @property {string} content
 */

/**
 * Build the tag list for one paper.
 *
 * @param {object} paper
 * @param {string} paper.title
 * @param {string[]} paper.authors
 * @param {number | null} paper.year
 * @param {string | null} [paper.publishedDate]
 * @param {string | null} [paper.journal]
 * @param {string | null} [paper.volume]
 * @param {string | null} [paper.issue]
 * @param {string | null} [paper.firstPage]
 * @param {string | null} [paper.lastPage]
 * @param {string} paper.doi
 * @param {object} urls
 * @param {string} urls.abstractUrl absolute URL of this page
 * @param {string | null} [urls.pdfUrl] absolute URL of the PDF, when hosted here
 * @returns {CitationTag[]}
 */
export function buildCitationTags(paper, urls) {
  const title = decodeEntities(paper.title).trim();
  const authors = (paper.authors ?? [])
    .map((name) => decodeEntities(name).trim())
    .filter(Boolean);
  const date = scholarDate(paper.publishedDate, paper.year);

  /*
   * REFUSES, rather than emitting a set Scholar will silently decline. Each
   * missing field is named, because "invalid citation tags" without the field
   * is a message somebody has to reverse engineer.
   */
  const missing = [];
  if (!title) missing.push("citation_title");
  if (authors.length === 0) missing.push("citation_author");
  if (!date) missing.push("citation_publication_date");
  if (missing.length > 0 || !date) {
    /*
     * `|| !date` is redundant to a reader and is NOT redundant to the compiler:
     * `date` is `string | null`, the list above is built by side effect, and
     * TypeScript cannot narrow a union through an array's length. The
     * alternative was a non-null assertion at the use site, which is the one
     * spelling that cannot be wrong at compile time and can be wrong at
     * runtime. This costs a clause and keeps the narrowing real.
     */
    throw new Error(
      `citation tags: ${missing.join(", ")} would be empty for ${paper.doi || "(no doi)"}. ` +
        "Google Scholar requires a title, at least one author and a date; a page " +
        "without them is not indexed at all.",
    );
  }

  /** @type {CitationTag[]} */
  const tags = [{ name: "citation_title", content: title }];
  // One tag each, in author order, which is itself data: this corpus is mostly
  // multi-author and the owner is outside the first three on 26 of 36 records.
  for (const name of authors) tags.push({ name: "citation_author", content: name });
  tags.push({ name: "citation_publication_date", content: date });

  const journal = decodeEntities(paper.journal ?? "").trim();
  if (journal) tags.push({ name: "citation_journal_title", content: journal });
  if (paper.volume) tags.push({ name: "citation_volume", content: String(paper.volume) });
  if (paper.issue) tags.push({ name: "citation_issue", content: String(paper.issue) });
  /*
   * Pages only where the record really has them. 24 of 36 carry none and two
   * carry an article number rather than a range, so `firstPage` is already null
   * on those; see `pageRange` in the generator for why that is a shape match
   * rather than a hyphen split.
   */
  if (paper.firstPage) tags.push({ name: "citation_firstpage", content: paper.firstPage });
  if (paper.lastPage) tags.push({ name: "citation_lastpage", content: paper.lastPage });
  if (paper.doi) tags.push({ name: "citation_doi", content: paper.doi });

  /*
   * `citation_abstract_html_url` names THIS page, which is the canonical
   * location of the abstract. It is the tag that tells Scholar the PDF and the
   * landing page are one record rather than two.
   */
  tags.push({ name: "citation_abstract_html_url", content: urls.abstractUrl });
  // Only when the file is actually served from this site. A tag pointing at a
  // publisher's PDF is a claim this site cannot honor and Scholar will not
  // follow it across a host anyway.
  if (urls.pdfUrl) tags.push({ name: "citation_pdf_url", content: urls.pdfUrl });

  return tags;
}

/** The three whose absence stops a paper being indexed. Exported for the gate. */
export const REQUIRED_CITATION_TAGS = [
  "citation_title",
  "citation_author",
  "citation_publication_date",
];
