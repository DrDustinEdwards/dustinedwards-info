/**
 * The reader-chosen ordering of search results, in one place so a test can reach it.
 *
 * It is `.mjs` for the reason `visibility.mjs` and `query.mjs` are: the Worker imports it from
 * TypeScript and `node --test` imports the same file, so the rule that ships and the rule that is
 * tested cannot be two rules that agree by inspection.
 *
 * RELEVANCE IS THE DEFAULT AND STAYS THE DEFAULT. The best pages on this site are old papers, and
 * a date-first list buries them under whatever was written most recently.
 *
 * @see test/search-sort.test.mjs
 */

/**
 * @typedef {"relevance" | "date"} SearchSort
 */

/**
 * Unknown, absent and misspelled all mean relevance.
 *
 * Parsed at the edge so an arbitrary `?sort=` never travels further than the route's own
 * parameter reader, and the union is what the rest of the code sees.
 *
 * @param {string | null | undefined} value
 * @returns {SearchSort}
 */
export function parseSort(value) {
  return value === "date" ? "date" : "relevance";
}

/**
 * Order a fused hit list.
 *
 * RELEVANCE RETURNS THE ARRAY IT WAS GIVEN, not a copy of it: fusion already ordered the list and
 * re-sorting it by a constant comparator would be a no-op whose only effect is to depend on the
 * sort being stable.
 *
 * UNDATED ROWS SORT LAST. `publishAt` is null for a page with no date, and "newest" has nothing
 * to say about a page with no date, so it goes to the bottom.
 *
 * The sentinel is `-Infinity` and NOT 0, though 0 gives the same answer for every row this corpus
 * holds. That is the point: 0 works only because every publish date is after the epoch, which is a
 * property of the content rather than of the rule. `-Infinity` is below any timestamp, including a
 * negative one, so the ordering does not quietly depend on a fact nothing checks. Measured while
 * writing the test: a null-as-zero implementation produces an identical list here, which is why
 * the test discriminates on a pre-epoch date rather than on a null.
 *
 * IT DOES NOT PAGINATE. The caller slices after calling this, because sorting one page of ten
 * reorders that page and leaves the others alone, which reads as a broken list rather than a
 * sorted one.
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
