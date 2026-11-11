// COinS: Zotero and its relatives scan for .Z3988 and read only the title attribute, so the span stays
// empty. Index only: a list page cannot carry per-paper citation_* tags, and paper pages already do.

import { coinsTitle as coinsShared } from "@drdustinedwards/site-helpers/scholar";

import { CITATION_OPTIONS } from "./exports.mjs";

/**
 * Prelum's coinsTitle (OpenURL, ANSI/NISO Z39.88) with this site's author aliases. Key order is fixed so the output is
 * a pure function of the values.
 *
 * @param {any} paper
 * @returns {string}
 */
export function coinsTitle(paper) {
  return coinsShared(paper, CITATION_OPTIONS);
}
