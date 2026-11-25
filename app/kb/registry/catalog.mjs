// The master inventory (docs/REGISTRY.md): every kind and the phages in one catalog, read from the rows the routes hand it.
// A phage is read from the phages table, never copied into the registry.

import { defineCatalog } from "capsomer/behavior/catalog";
import { HOSTS } from "../../lib/phages/compile.mjs";
import { KINDS } from "./kinds.mjs";
import { stated } from "./primer.mjs";
import { LAB_PATH, hasItemPage, itemPath, kindPath } from "./address.mjs";
import { DIRECTION_LABELS, primerRow } from "./catalog-primers.mjs";

/** A phage's host as plain words: the table's short form without its emphasis marks. @param {string | null} host */
function hostWords(host) {
  const entry = host ? /** @type {Record<string, { short: string }>} */ (HOSTS)[host] : null;
  return entry ? entry.short.replaceAll("*", "") : null;
}

/** The kind's label in the inventory's words, singular. @param {string} kind */
export function kindLabel(kind) {
  if (kind === "phage") return "Phage";
  const singular = KINDS[kind]?.singular ?? kind;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/**
 * One line about an item, read from its own record: what a reader scanning the inventory wants beside the name.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 */
function summaryOf(item) {
  if (item.kind === "primer") {
    const row = primerRow(item);
    return [
      row.direction
        ? `${DIRECTION_LABELS[row.direction]?.toLowerCase() ?? row.direction} primer`
        : "primer",
      row.target,
      row.length ? `${row.length} nt` : null,
    ]
      .filter(Boolean)
      .join(", ");
  }
  if (item.kind === "strain") {
    const f = /** @type {Record<string, unknown>} */ (item.fields);
    return [
      stated(f.organism),
      stated(f.collection) && stated(f.collection_number)
        ? `${stated(f.collection)} ${stated(f.collection_number)}`
        : null,
    ]
      .filter(Boolean)
      .join(", ");
  }
  if (item.kind === "equipment") {
    return [stated(/** @type {Record<string, unknown>} */ (item.fields).manufacturer)]
      .filter(Boolean)
      .join(", ");
  }
  if (item.kind === "reagent") {
    const f = /** @type {Record<string, unknown>} */ (item.fields);
    return [
      stated(f.abbreviation),
      stated(f.contents),
      f.prepared_in_lab === true ? "prepared in lab" : stated(f.supplier),
    ]
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

/**
 * @param {import("./kinds.mjs").RegistryItem[]} items
 * @param {Array<{ name: string, year: number, host: string | null, county: string | null }>} phages
 */
export function inventoryRows(items, phages) {
  return [
    ...items.map((item) => ({
      key: `${item.kind}/${item.id}`,
      kind: item.kind,
      kindLabel: kindLabel(item.kind),
      name: item.name,
      summary: summaryOf(item),
      path: hasItemPage(item.kind) ? itemPath(item.kind, item.id) : kindPath(item.kind),
    })),
    ...phages.map((phage) => ({
      key: `phage/${phage.name.toLowerCase()}`,
      kind: "phage",
      kindLabel: kindLabel("phage"),
      name: phage.name,
      summary: [`found in ${phage.year}`, hostWords(phage.host), phage.county]
        .filter(Boolean)
        .join(", "),
      path: `/research/phages#${phage.name.toLowerCase()}`,
    })),
  ];
}

/** @typedef {ReturnType<typeof inventoryRows>[number]} InventoryRow */

/** Where a kind sits in the inventory's order: the registry's kinds as defined, then the phages. @param {string} kind */
function kindRank(kind) {
  const at = Object.keys(KINDS).indexOf(kind);
  return at === -1 ? Object.keys(KINDS).length : at;
}

/** The master inventory catalog: every item of every kind, filtered by kind. */
export const INVENTORY = defineCatalog(
  /** @type {import("capsomer/behavior/catalog").CatalogDefinition<InventoryRow>} */ ({
    id: "lab",
    noun: ["item", "items"],
    basePath: LAB_PATH,
    itemKey: (row) => row.key,
    defaultSort: "kind",
    pageSize: 50,
    fields: [
      {
        key: "name",
        label: "Name",
        value: (row) => row.name,
        search: 3,
        column: { header: "Name" },
        sort: true,
      },
      {
        key: "kind",
        label: "Kind",
        value: (row) => row.kind,
        facet: { kind: "many", general: true, label: kindLabel },
        column: { header: "Kind", drop: 2 },
        // The registry's kinds in the order they are defined, the phages after them, then by name: the default order
        // reads the lab's own records first and never buries them behind seventy-five phages.
        sort: {
          compare: (a, b) =>
            kindRank(a.kind) - kindRank(b.kind) ||
            a.name.localeCompare(b.name, "en", { numeric: true }),
        },
        search: 1,
      },
      {
        key: "summary",
        label: "About",
        value: (row) => row.summary,
        search: 2,
        column: { header: "About", drop: 1 },
      },
    ],
  }),
);
