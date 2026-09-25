// One builder so the route, check:features and the twin agree; the gate asserts over its result.
// Scholar skips a page missing title, author or date entirely, so a partial set is refused. One
// citation_author per author: a joined tag reads as one person. Scholar requires the PDF in the same
// subdirectory as the abstract page; paths.mjs owns both URLs.

import { decodeEntities } from "./entities.mjs";

/**
 * A separator swap, not a reformat, so a partial date stays partial instead of inventing a day.
 *
 * @param {string | null | undefined} isoish `YYYY-MM-DD`, `YYYY-MM` or `YYYY`
 * @param {number | null | undefined} year fallback when no date was deposited
 * @returns {string | null}
 */
function scholarDate(isoish, year) {
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

  const missing = [];
  if (!title) missing.push("citation_title");
  if (authors.length === 0) missing.push("citation_author");
  if (!date) missing.push("citation_publication_date");
  if (missing.length > 0 || !date) {
    // `|| !date` looks redundant but lets TypeScript narrow date without a non-null assertion.
    throw new Error(
      `citation tags: ${missing.join(", ")} would be empty for ${paper.doi || "(no doi)"}. ` +
        "Google Scholar requires a title, at least one author and a date; a page " +
        "without them is not indexed at all.",
    );
  }

  /** @type {CitationTag[]} */
  const tags = [{ name: "citation_title", content: title }];
  for (const name of authors) tags.push({ name: "citation_author", content: name });
  tags.push({ name: "citation_publication_date", content: date });

  const journal = decodeEntities(paper.journal ?? "").trim();
  if (journal) tags.push({ name: "citation_journal_title", content: journal });
  if (paper.volume) tags.push({ name: "citation_volume", content: String(paper.volume) });
  if (paper.issue) tags.push({ name: "citation_issue", content: String(paper.issue) });
  if (paper.firstPage) tags.push({ name: "citation_firstpage", content: paper.firstPage });
  if (paper.lastPage) tags.push({ name: "citation_lastpage", content: paper.lastPage });
  if (paper.doi) tags.push({ name: "citation_doi", content: paper.doi });

  // Tells Scholar the PDF and this page are one record, not two.
  tags.push({ name: "citation_abstract_html_url", content: urls.abstractUrl });
  // Only when served from this site: Scholar will not follow a PDF on another host.
  if (urls.pdfUrl) tags.push({ name: "citation_pdf_url", content: urls.pdfUrl });

  return tags;
}

export const REQUIRED_CITATION_TAGS = [
  "citation_title",
  "citation_author",
  "citation_publication_date",
];
