// Relevance stays the default: the best pages here are old papers, which a date-first list buries.

/**
 * @typedef {"relevance" | "date"} SearchSort
 */

/** The sorts a request may name (`?sort=date`), for Capsomer's `oneOf`; anything else is relevance. */
export const SORTS = /** @type {const} */ (["relevance", "date"]);

/**
 * Undated rows sort last via -Infinity, not 0, which would misplace a pre-epoch date. The caller
 * paginates after sorting, since sorting one page of ten reads as a broken list.
 *
 * @template {{ publishAt: number | null }} T
 * @param {T[]} hits
 * @param {SearchSort} sort
 * @returns {T[]}
 */
export function applySort(hits, sort) {
  if (sort !== "date") return hits;
  return [...hits].sort((a, b) => (b.publishAt ?? -Infinity) - (a.publishAt ?? -Infinity));
}
