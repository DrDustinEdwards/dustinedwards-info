/**
 * The sort and filter the phage table on /research/phages gets in the browser, and the address of a PhagesDB
 * record. The table itself is drawn from the phage rows (content/phages, docs/PHAGES.md) into the page's
 * markdown and rendered with it, so with script off it is complete: every phage, and a PhagesDB link for exactly
 * the phages that have a verified record. app/enhance/phages.ts runs sortRows and filterRows on the rows it reads
 * back out of that table; the phage rows are judged by app/lib/phages/compile.mjs.
 */

import { foldText } from "./cv/view.mjs";

/**
 * The human page for a PhagesDB record name.
 *
 * @param {string} record
 */
export function phagesDbUrl(record) {
  return `https://phagesdb.org/phages/${record}/`;
}

/** @typedef {"name" | "year" | "host" | "county"} SortKey */
/** @typedef {"ascending" | "descending"} SortDirection */

/**
 * One table row as the browser reads it back: the cells' text, and the row's place in the page's own
 * order (year, then name), which breaks every tie.
 *
 * @typedef {object} PhageRow
 * @property {string} name
 * @property {number | null} year
 * @property {string} host
 * @property {string} county
 * @property {number} order
 */

/** @typedef {{ q: string, host: string, county: string }} PhageFilter */

/** The columns that sort, in table order, with the label each header reads. */
export const SORT_COLUMNS = /** @type {const} */ ([
  ["name", "Phage"],
  ["year", "Year"],
  ["host", "Host"],
  ["county", "County"],
]);

/** The page's own order: year, then name. */
export const DEFAULT_SORT = /** @type {{ key: SortKey, direction: SortDirection }} */ ({
  key: "year",
  direction: "ascending",
});

/**
 * @param {PhageRow} a
 * @param {PhageRow} b
 * @param {SortKey} key
 */
function compareBy(a, b, key) {
  if (key === "year") return (a.year ?? 0) - (b.year ?? 0);
  return foldText(a[key]).localeCompare(foldText(b[key]), "en", { numeric: true });
}

/**
 * A new array in the chosen order. A blank cell (no host or county on record) always sorts last,
 * whichever way the column runs, and ties keep the page's own order.
 *
 * @param {readonly PhageRow[]} rows
 * @param {SortKey} key
 * @param {SortDirection} direction
 * @returns {PhageRow[]}
 */
export function sortRows(rows, key, direction) {
  const sign = direction === "descending" ? -1 : 1;
  const blank = (/** @type {PhageRow} */ row) => (key === "year" ? row.year === null : row[key].trim() === "");
  return [...rows].sort((a, b) => {
    const blankA = blank(a);
    const blankB = blank(b);
    if (blankA !== blankB) return blankA ? 1 : -1;
    const byKey = blankA ? 0 : compareBy(a, b, key) * sign;
    return byKey !== 0 ? byKey : a.order - b.order;
  });
}

/**
 * The rows a filter keeps. `q` matches every word against the name, year, host and county, folded so
 * case and accents do not matter; `host` and `county` match a cell exactly, and "" means any.
 *
 * @param {readonly PhageRow[]} rows
 * @param {PhageFilter} filter
 * @returns {PhageRow[]}
 */
export function filterRows(rows, filter) {
  const words = foldText(filter.q).split(" ").filter(Boolean);
  return rows.filter((row) => {
    if (filter.host && row.host !== filter.host) return false;
    if (filter.county && row.county !== filter.county) return false;
    if (words.length === 0) return true;
    const haystack = foldText(`${row.name} ${row.year ?? ""} ${row.host} ${row.county}`);
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * The distinct non-blank values of a column, for a select's options, in alphabetical order.
 *
 * @param {readonly PhageRow[]} rows
 * @param {"host" | "county"} key
 */
export function columnValues(rows, key) {
  const values = new Set(rows.map((row) => row[key].trim()).filter(Boolean));
  return [...values].sort((a, b) => a.localeCompare(b, "en"));
}

/**
 * What the live region says after a change.
 *
 * @param {number} shown
 * @param {number} total
 */
export function countText(shown, total) {
  if (shown === total) return `Showing all ${total} phages.`;
  if (shown === 0) return `No phages match. ${total} in all.`;
  return `Showing ${shown} of ${total} ${total === 1 ? "phage" : "phages"}.`;
}
