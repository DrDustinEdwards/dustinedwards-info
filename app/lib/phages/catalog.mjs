// The phage table's one declaration (docs/PHAGES.md): the fields a phage is searched, filtered, sorted and listed by,
// declared once for Capsomer's catalog. The table on /research/phages, its search and facets, and its counts all read
// this, so a field is described here and nowhere else. Pure: the route passes in the rows it read from D1. The page's
// markdown table (the twin, the search records, the invariants) is still written from the same rows by compile.mjs.

import { defineCatalog, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import { foldText } from "../cv/view.mjs";
import { HOSTS, PHAGES_PAGE_PATH, phageSlug } from "./compile.mjs";

/** @typedef {import("./compile.mjs").Phage} Phage */

/** A host as a facet option and a cell read it, without the markdown emphasis the page's text carries. @param {string} key */
export function hostLabel(key) {
  const host = /** @type {Record<string, { long: string }>} */ (HOSTS)[key];
  return host ? host.long.replaceAll("*", "") : key;
}

/** The page's own order: year, then name, folded so case and accents do not matter (the same as `sortPhages`). @param {Phage} a @param {Phage} b */
const byYearThenName = (a, b) => a.year - b.year || foldText(a.name).localeCompare(foldText(b.name), "en", { numeric: true });

export const PHAGES = defineCatalog(
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<Phage>} */ ({
    id: "phages",
    noun: ["phage", "phages"],
    basePath: PHAGES_PAGE_PATH,
    itemKey: (p) => phageSlug(p.name),
    // Year, then name: what the page has always listed. The year's own comparison carries the name tie-break.
    defaultSort: "year",
    fields: [
      { key: "name", label: "Name", value: (p) => p.name, search: 3, sort: true, column: { header: "Phage" } },
      { key: "formerly", label: "Formerly", value: (p) => p.formerly, search: 1 },
      {
        key: "year",
        label: "Year",
        value: (p) => p.year,
        type: "number",
        sort: { compare: byYearThenName, labels: { asc: "oldest first", desc: "newest first" } },
        facet: { kind: "many", order: "alpha", limit: 6 },
        column: { header: "Year", align: "end" },
      },
      { key: "host", label: "Host", value: (p) => p.host, facet: { kind: "many", general: true, label: hostLabel }, column: { header: "Host", drop: 1 } },
      { key: "county", label: "County", value: (p) => p.county, search: 1, facet: { kind: "many", order: "alpha" }, column: { header: "County", drop: 2 } },
      { key: "phagesdb", label: "PhagesDB", value: (p) => p.phagesdb, column: { header: "PhagesDB", drop: 2 } },
      { key: "paper", label: "Genome paper", value: (p) => (p.paper ? "published" : null), facet: { kind: "one", label: () => "Published" }, column: { header: "Paper", drop: 2 } },
    ],
  }),
);

/**
 * The page's state for an address.
 *
 * @param {URLSearchParams | string} params
 * @param {Phage[]} phages every phage
 */
export function phageListing(params, phages) {
  return queryCatalog(PHAGES, phages, parseCatalogParams(PHAGES, params));
}
