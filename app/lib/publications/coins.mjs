// COinS: Zotero and its relatives scan for .Z3988 and read only the title attribute, so the span stays
// empty. Index only: a list page cannot carry per-paper citation_* tags, and paper pages already do.

import { canonicalAuthor } from "./exports.mjs";
import { decodeEntities } from "./entities.mjs";

const GENRE = {
  article: "article",
  review: "article",
  abstract: "conference",
  chapter: "bookitem",
  "teaching-resource": "document",
};

/**
 * Key order is fixed so the output is a pure function of the values; check:machine-readable compares bytes.
 *
 * @param {any} paper
 * @returns {string}
 */
export function coinsTitle(paper) {
  /** @type {[string, string][]} */
  const pairs = [
    ["ctx_ver", "Z39.88-2004"],
    ["rft_val_fmt", "info:ofi/fmt:kev:mtx:journal"],
    ["rft.genre", GENRE[/** @type {keyof typeof GENRE} */ (paper.type)] ?? "article"],
    ["rft.atitle", decodeEntities(paper.title)],
  ];
  if (paper.journal) pairs.push(["rft.jtitle", decodeEntities(paper.journal)]);
  if (paper.year) pairs.push(["rft.date", String(paper.year)]);
  if (paper.volume) pairs.push(["rft.volume", String(paper.volume)]);
  if (paper.issue) pairs.push(["rft.issue", String(paper.issue)]);
  if (paper.firstPage) pairs.push(["rft.spage", paper.firstPage]);
  if (paper.lastPage) pairs.push(["rft.epage", paper.lastPage]);
  // One rft.au per author: a joined string reads as one author with a very long name.
  for (const name of paper.authors ?? []) {
    pairs.push(["rft.au", canonicalAuthor(name)]);
  }
  if (paper.doi) {
    // info:doi/ is the form OpenURL specifies; a bare DOI in rft_id is not.
    pairs.push(["rft_id", `info:doi/${paper.doi}`]);
  }

  // encodeURIComponent, not URLSearchParams, which encodes a space as +, a literal plus here.
  return pairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
