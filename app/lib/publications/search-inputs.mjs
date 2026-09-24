// PDF full text is deliberately left out: FTS5 snippets over two-column machine text would match running
// heads and show mangled lines, and Ask reads the twins instead. Includes papers the index hides.

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
      // The paper: namespace keeps these uids separable from hand-authored pages when search_docs is pruned.
      uid: `paper:${slug}`,
      url: paperPath(slug),
      title: decodeEntities(paper.title),
      // Decoded, or a search for p < 0.05 finds nothing and the snippet shows markup.
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
