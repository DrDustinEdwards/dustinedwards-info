// The strains catalog (docs/REGISTRY.md): a strain's row, the phages isolated on it and the protocols that use it, and its markdown twin.

import { mdLink } from "../md-link.mjs";
import { defineCatalog } from "capsomer/behavior/catalog";
import { missingReason, stated } from "./primer.mjs";
import { designationOf } from "./strain.mjs";
import { plural } from "@drdustinedwards/site-helpers/text";
import { itemPath, itemTwin, kindPath } from "./address.mjs";

/**
 * A strain as the pages read it: the record's own fields, and what is computed from elsewhere: its designation (from its
 * fields), and the phages isolated on it, read from the phages table by the host key that is the strain's own id. Nothing
 * computed is stored, so a phage added to the table is on the strain's page with no edit to the strain.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @param {Array<{ name: string, year: number, host: string | null }>} [phages] every phage, from the phages table
 */
export function strainRow(item, phages = []) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  const isolated = phages
    .filter((phage) => phage.host === item.id)
    .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, "en", { numeric: true }));
  const years = isolated.map((phage) => phage.year);
  return {
    id: item.id,
    path: itemPath("strain", item.id),
    name: item.name,
    organism: stated(f.organism),
    strain: stated(f.strain),
    designation: designationOf(f),
    collection: stated(f.collection),
    collectionNumber: stated(f.collection_number),
    guideUrl: stated(f.guide_url),
    biosafetyLevel: stated(f.biosafety_level),
    biosafetyLevelMissing: missingReason(f.biosafety_level),
    phages: isolated.map((phage) => ({
      name: phage.name,
      year: phage.year,
      path: `/research/phages#${phage.name.toLowerCase()}`,
    })),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    draft: item.status === "draft",
  };
}

/** @typedef {ReturnType<typeof strainRow>} StrainRow */

/** The strains as rows, each with the phages isolated on it. @param {import("./kinds.mjs").RegistryItem[]} items @param {Array<{ name: string, year: number, host: string | null }>} phages */
export function strainRows(items, phages) {
  return items.filter((item) => item.kind === "strain").map((item) => strainRow(item, phages));
}

/** The strains catalog: the columns a strain is read by. */
export const STRAINS = defineCatalog(
  /** @type {import("capsomer/behavior/catalog").CatalogDefinition<StrainRow>} */ ({
    id: "strains",
    noun: ["strain", "strains"],
    basePath: kindPath("strain"),
    itemKey: (s) => s.id,
    defaultSort: "name",
    pageSize: 25,
    fields: [
      {
        key: "name",
        label: "Strain",
        value: (s) => s.name,
        search: 3,
        column: { header: "Strain" },
        sort: true,
      },
      {
        key: "organism",
        label: "Organism",
        value: (s) => s.organism,
        facet: { kind: "many", order: "alpha" },
        search: 2,
        column: { header: "Organism", drop: 1 },
      },
      {
        key: "collection",
        label: "Collection",
        value: (s) => s.collection,
        facet: { kind: "many", order: "alpha" },
        search: 1,
        column: { header: "Collection", drop: 2 },
      },
      {
        key: "number",
        label: "Collection number",
        value: (s) => s.collectionNumber,
        search: 2,
        column: { header: "Collection number", drop: 2 },
      },
      {
        key: "phages",
        label: "Phages isolated",
        value: (s) => s.phages.length,
        type: "number",
        sort: true,
        column: { header: "Phages isolated", align: "end", drop: 1 },
      },
    ],
  }),
);

/**
 * The protocols that use a strain: each published protocol names its host strains by id, so the use is read from the
 * protocols and never listed on the strain.
 *
 * @param {{ id: string }} strain
 * @param {Array<{ path: string, title: string, hostStrains?: Array<{ id: string }> }>} protocols
 */
export function protocolsUsingStrain(strain, protocols) {
  return protocols
    .filter((protocol) => (protocol.hostStrains ?? []).some((s) => s.id === strain.id))
    .map((protocol) => ({ path: protocol.path, title: protocol.title }));
}

/** The span of years the phages on a strain were isolated in, in words: "2018", or "2018 to 2025". @param {StrainRow} strain */
export function phageYearsText(strain) {
  if (strain.firstYear === null) return null;
  return strain.firstYear === strain.lastYear
    ? String(strain.firstYear)
    : `${strain.firstYear} to ${strain.lastYear}`;
}

/**
 * One strain as markdown for the twin: the same facts the page states, with a fact nobody has set said with its reason.
 *
 * @param {StrainRow} strain
 * @param {Array<{ path: string, title: string }>} usedBy
 * @param {string} origin
 */
export function strainMarkdown(strain, usedBy, origin) {
  const years = phageYearsText(strain);
  const lines = [
    strain.organism ? `- Organism: ${strain.organism}` : "",
    strain.strain ? `- Strain: ${strain.strain}` : "",
    strain.collection && strain.collectionNumber
      ? `- Collection: ${strain.collection} ${strain.collectionNumber}`
      : "",
    strain.guideUrl ? `- SEA-PHAGES Guide page: ${strain.guideUrl}` : "",
    `- Biosafety level: ${strain.biosafetyLevel ?? `not found (${strain.biosafetyLevelMissing ?? "not recorded"})`}`,
    "",
    "## Phages isolated on it",
    "",
    strain.phages.length === 0
      ? "No phage in the lab's table names this host."
      : `${plural(strain.phages.length, "phage")}, found ${years}, counted from the phages table.`,
    "",
    ...strain.phages.map((phage) => `- ${mdLink(phage.name, origin + phage.path)}, ${phage.year}`),
    "",
    ...usedBy.map((protocol) => `- Used in: ${mdLink(protocol.title, origin + protocol.path)}`),
  ];
  return itemTwin(strain.name, lines);
}
