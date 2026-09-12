/**
 * The publication corpus as the shape `recordsForPapers` consumes.
 *
 * The counterpart of `colophonPageInput` for a different corpus, and it exists
 * for the reason that one does: `records.mjs` is the one indexer and must not
 * learn a corpus's field names. This is the only place that knows how a paper's
 * indexable text is assembled.
 *
 * ## WHAT GOES IN THE BODY, AND WHY THE FULL TEXT DOES NOT
 *
 * The plain-language line, the abstract, the authors, the venue and the year.
 * That is what a person types into a search box when they are looking for a
 * paper: a phrase from the abstract, a coauthor's surname, a journal, a year.
 *
 * The extracted PDF text is deliberately absent, and this is the split ruling
 * 63 draws between the two indexes. Classic search is keyword search over FTS5
 * and it shows a snippet of what matched: 1.13 MB of machine-read two-column
 * text would match constantly, on running heads and reference lists, and the
 * snippet a reader saw would be the mangled line the term happened to fall on.
 * The full text goes to Ask and the search MCP, which read the twins, because
 * retrieval over a paper's body is exactly what those are for.
 *
 * ## ONE RECORD PER PAPER, INCLUDING THE THREE THE INDEX HIDES
 *
 * `/publications` hides three conference abstracts, because showing a meeting
 * abstract beside the paper it became repeats the same work to a reader
 * browsing. Search is not browsing: somebody searching for that abstract's
 * title wants the page, which exists, is in the sitemap, and answers 200. Same
 * reasoning the sitemap records for not applying the showcase filter either.
 */

import { decodeEntities } from "./entities.mjs";
import { doiSlug, paperPath } from "./paths.mjs";

/**
 * @param {Array<Record<string, any>>} publications the corpus, PUBLICATIONS
 * @returns {Array<{ uid: string, url: string, title: string, body: string }>}
 */
export function paperSearchInputs(publications) {
  return publications.map((paper) => {
    const slug = doiSlug(paper.doi);
    return {
      /*
       * `paper:` rather than `page:`, so a uid says which builder made it. The
       * uid is the primary key of `search_docs` and the thing a prune matches
       * on, and a namespace that is not shared with the hand-authored pages is
       * what keeps those two sets separable by looking at them.
       */
      uid: `paper:${slug}`,
      url: paperPath(slug),
      title: decodeEntities(paper.title),
      /*
       * DECODED, like every other boundary where this text becomes something a
       * reader reads. An abstract carrying `p &lt; 0.05` in the index is a
       * search for "p < 0.05" that finds nothing and a snippet showing markup.
       */
      body: [
        paper.summary,
        paper.abstract ? decodeEntities(paper.abstract) : null,
        paper.authors.map((/** @type {string} */ name) => decodeEntities(name)).join(", "),
        paper.journal ? decodeEntities(paper.journal) : null,
        String(paper.year),
        paper.doi,
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
}
