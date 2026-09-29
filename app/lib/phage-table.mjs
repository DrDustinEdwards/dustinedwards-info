/**
 * The phage table on /research/phages: which phages have a PhagesDB record, and the sort and filter
 * the table gets in the browser. The table itself is markdown (content/pages/research-phages.md),
 * rendered at build time, so with script off it is complete: every phage, and a PhagesDB link for
 * exactly the phages below that have one. app/enhance/phages.ts runs sortRows and filterRows on the
 * rows it reads back out of that table. test/phage-table.test.mjs holds the markdown to this record.
 */

import { foldText } from "./cv/view.mjs";

/**
 * Each phage in the table, keyed by the name the site spells it, to its record's name exactly as
 * PhagesDB spells it, or null where PhagesDB has no record for this phage.
 *
 * Verified 2026-09-29 against https://phagesdb.org/api/phages/<name>/ (200 JSON for a record, 404
 * otherwise), one request at a time, and against PhagesDB's Tarleton institution page. The API
 * matches a name case-insensitively, so a 200 is only this phage's record when PhagesDB's own
 * spelling, institution (TARL) and year agree. The site never calls PhagesDB at runtime; re-verify
 * by hand and edit this map and the markdown together.
 *
 * Null although the API answered 200, because the record is another lab's phage of the same name:
 * JayKay (Smith College, 2018) and Astrid (University of Pittsburgh, a Gordonia phage).
 * Null on a 404, with a near match on PhagesDB for Dustin to confirm: Phambo (PhagesDB has Fambo,
 * Tarleton, 2022, Stephenville). SoftSoap's record is spelled Softsoap on PhagesDB; the page linked
 * it by that spelling before this check, and the link is kept.
 *
 * @type {Readonly<Record<string, string | null>>}
 */
export const PHAGESDB_RECORDS = Object.freeze({
  Acorn15: "Acorn15",
  Allene: "Allene",
  Arlo: "Arlo",
  Ferdie: "Ferdie",
  Gibbonz: "Gibbonz",
  JayKay: null,
  Leia: null,
  Lucinda: "Lucinda",
  Malware: "Malware",
  MuskMan: null,
  Noonan: "Noonan",
  Nuggs: "Nuggs",
  Ryadel: "Ryadel",
  Sniffles: "Sniffles",
  Strudel: "Strudel",
  Texx: "Texx",
  TidBit: "TidBit",
  Trelle: "Trelle",
  Vero: "Vero",
  Aislinn: "Aislinn",
  Astrid: null,
  Finny: "Finny",
  Gustopher: "Gustopher",
  Hamburger: "Hamburger",
  KelliBelli: "KelliBelli",
  Puggeroni: "Puggeroni",
  Rowley: "Rowley",
  RubberBandz: "RubberBandz",
  Balloony: "Balloony",
  Epsy: "Epsy",
  Fizzles: "Fizzles",
  Lahey: "Lahey",
  NeonMoon: "NeonMoon",
  Rathburn: "Rathburn",
  Titoz: "Titoz",
  Virsces: "Virsces",
  Wednesday: "Wednesday",
  Agnetha: "Agnetha",
  Damoria: "Damoria",
  IndyLu: "IndyLu",
  Jewell: "Jewell",
  PurpleGoat: "PurpleGoat",
  Tank18: "Tank18",
  BenitoVP: "BenitoVP",
  BlueJean: "BlueJean",
  DopeGoat: "DopeGoat",
  Enchi: "Enchi",
  EnderDragon: "EnderDragon",
  Grapple: "Grapple",
  HandsomeSquid: "HandsomeSquid",
  Interrobang: "Interrobang",
  LemonZest: "LemonZest",
  Loca: "Loca",
  Obsidian: "Obsidian",
  Besitos: "Besitos",
  CutiePie: "CutiePie",
  DaddyP: "DaddyP",
  DJDoc: "DJDoc",
  Milagros: "Milagros",
  Nephthys: "Nephthys",
  Padme: "Padme",
  Phambo: null,
  Ashaug: "Ashaug",
  BoneCarver: "BoneCarver",
  EarlyBird: "EarlyBird",
  Ganandorf: "Ganandorf",
  Godfather: "Godfather",
  Kudou: "Kudou",
  Tarleton: null,
  Tiland: "Tiland",
  BlueMoth: "BlueMoth",
  Eppendorf: null,
  HoneyBear: "HoneyBear",
  JohnMadden: null,
  SoftSoap: "Softsoap",
  Blimey: "Blimey",
  Carino: "Carino",
  PaleRider: "PaleRider",
  Rira: "Rira",
  Triri: "Triri",
});

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
