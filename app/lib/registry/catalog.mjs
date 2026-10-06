// How the registry reads on the site (docs/REGISTRY.md): its addresses, the master inventory over every kind and the
// phages, and each kind's own catalog, declared once for Capsomer's catalog so the page, its facets and counts, its
// sort menu and the markdown twin all read one declaration. Pure: the routes hand it the rows they read from D1.
//
// Nothing is typed again here. A primer's length, GC content, reverse complement and Tm come from its sequence, the
// protocols that use it are found by that sequence, and a phage in the inventory is read from the phages table, never
// copied into the registry.

import { defineCatalog } from "capsomer/behaviour/catalog";

import { HOSTS } from "../phages/compile.mjs";
import { reverseComplement } from "../primers.mjs";
import { KINDS } from "./kinds.mjs";
import { MAX_MISMATCHES, pairProducts, placePrimer } from "./align.mjs";
import { missingReason, primerFacts, stated } from "./primer.mjs";
import { designationOf } from "./strain.mjs";
import { NEB_TM_CALCULATOR, TM_CONDITIONS, annealingSentence, tmStatement } from "./tm.mjs";

/** The master inventory, and the root every kind's page sits under. */
export const LAB_PATH = "/research/lab";

/** The kind's page, from its plural: /research/lab/primers. @param {string} kind @param {Record<string, import("./kinds.mjs").KindSpec>} [kinds] */
export function kindPath(kind, kinds = KINDS) {
  return `${LAB_PATH}/${kinds[kind]?.plural ?? kind}`;
}

/** An item's page: /research/lab/primers/lco1490. @param {string} kind @param {string} id @param {Record<string, import("./kinds.mjs").KindSpec>} [kinds] */
export function itemPath(kind, id, kinds = KINDS) {
  return `${kindPath(kind, kinds)}/${id}`;
}

/**
 * The kind a URL segment names (its plural), or null.
 *
 * @param {string} segment
 * @param {Readonly<Record<string, import("./kinds.mjs").KindSpec>>} [kinds]
 */
export function kindFromSegment(segment, kinds = KINDS) {
  return Object.keys(kinds).find((kind) => kinds[kind]?.plural === segment) ?? null;
}

export { stated };

/**
 * The library's tabs for the registry: one for each kind that has a published item, linking to the kind's page, in the
 * order the kinds are defined. A kind with no item has no tab, so none points at an empty page.
 *
 * @param {import("./kinds.mjs").RegistryItem[]} items
 * @param {Readonly<Record<string, import("./kinds.mjs").KindSpec>>} [kinds]
 */
export function registryTabs(items, kinds = KINDS) {
  return Object.keys(kinds).flatMap((kind) => {
    const count = items.filter((item) => item.kind === kind).length;
    const plural = kinds[kind]?.plural ?? kind;
    return count === 0 ? [] : [{ id: plural, label: plural.charAt(0).toUpperCase() + plural.slice(1), count, href: kindPath(kind, kinds) }];
  });
}

/* ------------------------------------------------------------------------------------------------ primers */

/**
 * A primer as the pages read it: the record's own fields, the literature as read (and what could not be), and what is
 * computed: from its sequence, its length, GC content, Tm and reverse complement; from its reference, its placement; and by
 * comparison, whether its sequence matches the one the paper prints. Nothing computed is stored.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 */
export function primerRow(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  const sequence = stated(f.sequence);
  const reference = stated(f.reference);
  const facts = sequence ? primerFacts(sequence) : { length: null, gcPercent: null, tm: null };
  const printed = stated(f.published_sequence);
  return {
    id: item.id,
    path: itemPath("primer", item.id),
    name: item.name,
    sequence,
    reverseComplement: sequence && /^[ACGT]+$/.test(sequence) ? reverseComplement(sequence) : null,
    direction: stated(f.direction),
    target: stated(f.target),
    set: stated(f.set),
    reference,
    // Where it binds the reference, computed: null when it has no reference or binds nowhere within the mismatch limit.
    placement: sequence && reference ? placePrimer(sequence, reference) : null,
    // What the literature says, as read. Each `...Missing` is the reason it could not be found, shown so it is not hunted for.
    publishedIn: stated(f.published_in),
    publishedInMissing: missingReason(f.published_in),
    publishedDoi: stated(f.published_doi),
    publishedUrl: stated(f.published_url),
    publishedName: stated(f.published_name),
    publishedNameMissing: missingReason(f.published_name),
    publishedSequence: printed,
    publishedSequenceMissing: missingReason(f.published_sequence),
    publishedProduct: stated(f.published_product),
    publishedProductMissing: missingReason(f.published_product),
    // A comparison, never a field: null when the paper's sequence was not read, true when the stored one equals it.
    matchesPublished: printed && sequence ? printed === sequence : null,
    length: facts.length,
    gcPercent: facts.gcPercent,
    tm: facts.tm,
    draft: item.status === "draft",
  };
}

/** @typedef {ReturnType<typeof primerRow>} PrimerRow */

/**
 * The primers as rows with their pair's product computed, which a row alone cannot say: the product needs both primers of a
 * set, placed on their one reference.
 *
 * @param {import("./kinds.mjs").RegistryItem[]} items
 */
export function primerRows(items) {
  const rows = items.filter((item) => item.kind === "primer").map(primerRow);
  return rows.map((row) => ({ ...row, product: pairProduct(row, rows) }));
}

/** @typedef {ReturnType<typeof primerRows>[number]} PrimerListRow */

const DIRECTION_LABELS = /** @type {Record<string, string>} */ ({ forward: "Forward", reverse: "Reverse", probe: "Probe" });

/**
 * One line of a pair's product as the catalog and the twin show it: "281 bp", and "at 2 sites" when the pair binds twice (the
 * two LTRs of a provirus), or each size when the sites differ.
 *
 * @param {{ products: Array<{ length: number }> } | null} pair
 */
export function productText(pair) {
  if (!pair) return null;
  const sizes = [...new Set(pair.products.map((p) => p.length))];
  const text = sizes.map((s) => `${s} bp`).join(" or ");
  return pair.products.length > 1 && sizes.length === 1 ? `${text} at ${pair.products.length} sites` : text;
}

/** The primers catalog: the columns a primer is read by, which are its own and not a protocol's. */
export const PRIMERS = defineCatalog(
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<PrimerListRow>} */ ({
    id: "primers",
    noun: ["primer", "primers"],
    basePath: kindPath("primer"),
    itemKey: (p) => p.id,
    defaultSort: "name",
    pageSize: 25,
    fields: [
      { key: "name", label: "Primer", value: (p) => p.name, search: 3, column: { header: "Primer" }, sort: true },
      { key: "sequence", label: "Sequence (5′ to 3′)", value: (p) => p.sequence ?? "", search: 2, column: { header: "Sequence (5′ to 3′)", drop: 1 } },
      {
        key: "direction",
        label: "Direction",
        value: (p) => p.direction,
        facet: { kind: "many", general: true, label: (value) => DIRECTION_LABELS[value] ?? value },
        column: { header: "Direction", drop: 2 },
      },
      { key: "target", label: "Target", value: (p) => p.target, facet: { kind: "many", order: "alpha" }, search: 2, column: { header: "Target", drop: 1 } },
      { key: "set", label: "Set", value: (p) => p.set, search: 1 },
      { key: "length", label: "Length (nt)", value: (p) => p.length, type: "number", sort: true, column: { header: "Length (nt)", align: "end", drop: 2 } },
      { key: "tm", label: "Tm estimate (°C)", value: (p) => p.tm, type: "number", sort: true, column: { header: "Tm estimate (°C)", align: "end", drop: 2 } },
      { key: "product", label: "Product (computed)", value: (p) => productText(p.product), column: { header: "Product (computed)", drop: 2 } },
    ],
  }),
);

/**
 * The primer in the same set that pairs with this one: the other direction, in the same set. Null when it has no set or
 * the set holds no mate.
 *
 * @param {PrimerRow} primer
 * @param {PrimerRow[]} primers
 */
export function mateOf(primer, primers) {
  if (!primer.set) return null;
  return primers.find((p) => p.id !== primer.id && p.set === primer.set && p.direction !== primer.direction) ?? null;
}

/**
 * The product the pair of a primer makes on its reference, computed from the two sequences and the reference they share
 * (align.mjs), so it is stored nowhere and shown on both primers. Null when the primer has no mate, the pair shares no
 * reference, or either primer does not bind it.
 *
 * @param {PrimerRow} primer
 * @param {PrimerRow[]} primers
 */
export function pairProduct(primer, primers) {
  const mate = mateOf(primer, primers);
  if (!mate || !primer.sequence || !mate.sequence || !primer.reference || primer.reference !== mate.reference) return null;
  const forward = primer.direction === "forward" ? primer : mate;
  const reverse = primer.direction === "forward" ? mate : primer;
  if (forward.direction !== "forward" || reverse.direction !== "reverse" || !forward.sequence || !reverse.sequence) return null;
  return pairProducts(forward.sequence, reverse.sequence, primer.reference);
}

/**
 * The protocols that use a primer: each published protocol names its primers by id (and carries the registry's facts for
 * them), so the use is read from the protocols and never listed on the primer.
 *
 * @param {PrimerRow} primer
 * @param {Array<{ path: string, title: string, primers: Array<{ id: string }> }>} protocols
 */
export function protocolsUsing(primer, protocols) {
  return protocols
    .filter((protocol) => protocol.primers.some((p) => p.id === primer.id))
    .map((protocol) => ({ path: protocol.path, title: protocol.title }));
}

/* ------------------------------------------------------------------------------------------------ strains */

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
  const isolated = phages.filter((phage) => phage.host === item.id).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, "en", { numeric: true }));
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
    phages: isolated.map((phage) => ({ name: phage.name, year: phage.year, path: `/research/phages#${phage.name.toLowerCase()}` })),
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
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<StrainRow>} */ ({
    id: "strains",
    noun: ["strain", "strains"],
    basePath: kindPath("strain"),
    itemKey: (s) => s.id,
    defaultSort: "name",
    pageSize: 25,
    fields: [
      { key: "name", label: "Strain", value: (s) => s.name, search: 3, column: { header: "Strain" }, sort: true },
      { key: "organism", label: "Organism", value: (s) => s.organism, facet: { kind: "many", order: "alpha" }, search: 2, column: { header: "Organism", drop: 1 } },
      { key: "collection", label: "Collection", value: (s) => s.collection, facet: { kind: "many", order: "alpha" }, search: 1, column: { header: "Collection", drop: 2 } },
      { key: "number", label: "Collection number", value: (s) => s.collectionNumber, search: 2, column: { header: "Collection number", drop: 2 } },
      { key: "phages", label: "Phages isolated", value: (s) => s.phages.length, type: "number", sort: true, column: { header: "Phages isolated", align: "end", drop: 1 } },
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
  return strain.firstYear === strain.lastYear ? String(strain.firstYear) : `${strain.firstYear} to ${strain.lastYear}`;
}

/** The strains as a markdown table for the twin. @param {StrainRow[]} strains @param {string} origin */
export function strainsMarkdown(strains, origin) {
  const lines = strains.map(
    (s) => `| [${cell(s.name)}](${origin}${s.path}) | ${cell(s.organism)} | ${cell(s.collection)} | ${cell(s.collectionNumber)} | ${s.phages.length} |`,
  );
  return [
    "| Strain | Organism | Collection | Collection number | Phages isolated |",
    "| --- | --- | --- | --- | --- |",
    ...lines,
  ].join("\n");
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
    strain.collection && strain.collectionNumber ? `- Collection: ${strain.collection} ${strain.collectionNumber}` : "",
    strain.guideUrl ? `- SEA-PHAGES Guide page: ${strain.guideUrl}` : "",
    `- Biosafety level: ${strain.biosafetyLevel ?? `not found (${strain.biosafetyLevelMissing ?? "not recorded"})`}`,
    "",
    "## Phages isolated on it",
    "",
    strain.phages.length === 0
      ? "No phage in the lab's table names this host."
      : `${strain.phages.length} phage${strain.phages.length === 1 ? "" : "s"}, found ${years}, counted from the phages table.`,
    "",
    ...strain.phages.map((phage) => `- [${phage.name}](${origin}${phage.path}), ${phage.year}`),
    "",
    ...usedBy.map((protocol) => `- Used in: [${protocol.title}](${origin}${protocol.path})`),
  ];
  return `# ${strain.name}\n\n${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/* ------------------------------------------------------------------------------------------------ reagents */

/**
 * What the protocols use of a reagent, read from the protocols that name it on one of their materials (`reagent: <id>`): each
 * protocol's own stock, final concentration and amount. Nothing is stored on the reagent, so a protocol's change shows here.
 *
 * @param {string} id
 * @param {Array<{ path: string, title: string, materials?: Array<{ reagent?: { id: string } | null, display?: string, group?: string | null, stock: string[], final: string | null, amount: string | null, per: string | null }> }>} protocols
 */
export function reagentUses(id, protocols) {
  return protocols.flatMap((protocol) => {
    const rows = (protocol.materials ?? [])
      .filter((m) => m.reagent?.id === id)
      .map((m) => ({ group: m.group ?? null, stock: m.stock, final: m.final, amount: m.amount, per: m.per }));
    return rows.length > 0 ? [{ path: protocol.path, title: protocol.title, rows }] : [];
  });
}

/** One use as words: "stock 3 M; final 40 mM; 20 µl per tube". @param {ReturnType<typeof reagentUses>[number]["rows"][number]} row */
export function useText(row) {
  return [
    row.stock.length > 0 ? `stock ${row.stock.join(" or ")}` : null,
    row.final ? `final ${row.final}` : null,
    row.amount ? `${row.amount}${row.per ? ` per ${row.per}` : ""}` : null,
    row.group ? `(${row.group})` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * A reagent as the pages read it: the record's own fields, with a supplier or catalog number nobody has recorded said with its
 * reason, and the protocols that use it, computed from the protocols.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @param {Parameters<typeof reagentUses>[1]} [protocols]
 */
export function reagentRow(item, protocols = []) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return {
    id: item.id,
    path: itemPath("reagent", item.id),
    name: item.name,
    abbreviation: stated(f.abbreviation),
    contents: stated(f.contents),
    supplier: stated(f.supplier),
    supplierMissing: missingReason(f.supplier),
    catalogNumber: stated(f.catalog_number),
    catalogNumberMissing: missingReason(f.catalog_number),
    productUrl: stated(f.product_url),
    uses: reagentUses(item.id, protocols),
    draft: item.status === "draft",
  };
}

/** @typedef {ReturnType<typeof reagentRow>} ReagentRow */

/** The reagents as rows, each with the protocols that use it. @param {import("./kinds.mjs").RegistryItem[]} items @param {Parameters<typeof reagentUses>[1]} protocols */
export function reagentRows(items, protocols) {
  return items.filter((item) => item.kind === "reagent").map((item) => reagentRow(item, protocols));
}

/** The reagents catalog: the columns a reagent is read by. */
export const REAGENTS = defineCatalog(
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<ReagentRow>} */ ({
    id: "reagents",
    noun: ["reagent", "reagents"],
    basePath: kindPath("reagent"),
    itemKey: (r) => r.id,
    defaultSort: "name",
    pageSize: 25,
    fields: [
      { key: "name", label: "Reagent", value: (r) => r.name, search: 3, column: { header: "Reagent" }, sort: true },
      { key: "abbreviation", label: "Abbreviation", value: (r) => r.abbreviation, search: 2 },
      { key: "contents", label: "Contents", value: (r) => r.contents, search: 1, column: { header: "Contents", drop: 2 } },
      { key: "supplier", label: "Supplier", value: (r) => r.supplier, facet: { kind: "many", order: "alpha" }, search: 1, column: { header: "Supplier", drop: 1 } },
      { key: "number", label: "Catalog number", value: (r) => r.catalogNumber, search: 2, column: { header: "Catalog number", drop: 1 } },
      { key: "protocols", label: "Protocols", value: (r) => r.uses.length, type: "number", sort: true, column: { header: "Protocols", align: "end", drop: 2 } },
    ],
  }),
);

/** The reagents as a markdown table for the twin. @param {ReagentRow[]} reagents @param {string} origin */
export function reagentsMarkdown(reagents, origin) {
  const lines = reagents.map(
    (r) => `| [${cell(r.name)}](${origin}${r.path}) | ${cell(r.abbreviation)} | ${cell(r.supplier)} | ${cell(r.catalogNumber)} | ${r.uses.length} |`,
  );
  return ["| Reagent | Abbreviation | Supplier | Catalog number | Protocols |", "| --- | --- | --- | --- | --- |", ...lines].join("\n");
}

/**
 * One reagent as markdown for the twin: the same facts the page states, with what nobody has recorded said with its reason.
 *
 * @param {ReagentRow} reagent
 * @param {string} origin
 */
export function reagentMarkdown(reagent, origin) {
  const lines = [
    reagent.abbreviation ? `- Abbreviation: ${reagent.abbreviation}` : "",
    reagent.contents ? `- Contents: ${reagent.contents}` : "",
    `- Supplier: ${reagent.supplier ?? `not found (${reagent.supplierMissing ?? "not recorded"})`}`,
    `- Catalog number: ${reagent.catalogNumber ?? `not found (${reagent.catalogNumberMissing ?? "not recorded"})`}`,
    reagent.productUrl ? `- Product page: ${reagent.productUrl}` : "",
    "",
    "## Used in",
    "",
    reagent.uses.length === 0 ? "No published protocol names this reagent." : "",
    ...reagent.uses.flatMap((use) => [
      `- [${use.title}](${origin}${use.path})`,
      ...use.rows.map((row) => `  - ${useText(row) || "no amount recorded"}`),
    ]),
  ];
  return `# ${reagent.name}\n\n${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/* ------------------------------------------------------------------------------------------------ inventory */

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
    return [row.direction ? `${DIRECTION_LABELS[row.direction]?.toLowerCase() ?? row.direction} primer` : "primer", row.target, row.length ? `${row.length} nt` : null]
      .filter(Boolean)
      .join(", ");
  }
  if (item.kind === "strain") {
    const f = /** @type {Record<string, unknown>} */ (item.fields);
    return [stated(f.organism), stated(f.collection) && stated(f.collection_number) ? `${stated(f.collection)} ${stated(f.collection_number)}` : null].filter(Boolean).join(", ");
  }
  if (item.kind === "reagent") {
    const f = /** @type {Record<string, unknown>} */ (item.fields);
    return [stated(f.abbreviation), stated(f.contents), stated(f.supplier)].filter(Boolean).join(", ");
  }
  return "";
}

/**
 * The inventory's rows: every published registry item, and every phage read from the phages table. A phage is its own
 * table's and page's, so its row links to its section on /research/phages and states nothing the table does not.
 *
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
      path: itemPath(item.kind, item.id),
    })),
    ...phages.map((phage) => ({
      key: `phage/${phage.name.toLowerCase()}`,
      kind: "phage",
      kindLabel: kindLabel("phage"),
      name: phage.name,
      summary: [`found in ${phage.year}`, hostWords(phage.host), phage.county].filter(Boolean).join(", "),
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
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<InventoryRow>} */ ({
    id: "lab",
    noun: ["item", "items"],
    basePath: LAB_PATH,
    itemKey: (row) => row.key,
    defaultSort: "kind",
    pageSize: 50,
    fields: [
      { key: "name", label: "Name", value: (row) => row.name, search: 3, column: { header: "Name" }, sort: true },
      {
        key: "kind",
        label: "Kind",
        value: (row) => row.kind,
        facet: { kind: "many", general: true, label: kindLabel },
        column: { header: "Kind", drop: 2 },
        // The registry's kinds in the order they are defined, the phages after them, then by name: the default order
        // reads the lab's own records first and never buries them behind seventy-five phages.
        sort: { compare: (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name, "en", { numeric: true }) },
        search: 1,
      },
      { key: "summary", label: "About", value: (row) => row.summary, search: 2, column: { header: "About", drop: 1 } },
    ],
  }),
);

/* ------------------------------------------------------------------------------------------------ markdown twins */

const cell = (/** @type {string | number | null} */ value) => String(value ?? "").replaceAll("|", "\\|");

/**
 * The inventory as a markdown table, for the twin: the facts a person sees.
 *
 * @param {InventoryRow[]} rows
 * @param {string} origin
 */
export function inventoryMarkdown(rows, origin) {
  const lines = rows.map((row) => `| [${cell(row.name)}](${origin}${row.path}) | ${cell(row.kindLabel)} | ${cell(row.summary)} |`);
  return ["| Name | Kind | About |", "| --- | --- | --- |", ...lines].join("\n");
}

/**
 * A site on a reference in words, as the page and the twin state it: its span in the accession's own coordinates, its
 * strand, and its mismatches counted from the primer's 5′ end, so a primer that binds only imperfectly says so.
 *
 * @param {{ strand: "+" | "-", start: number, end: number, mismatches: number, mismatchPositions: number[] }} site
 */
export function siteText(site) {
  const n = site.mismatches;
  const mismatch =
    n === 0
      ? "no mismatches"
      : `${n} mismatch${n === 1 ? "" : "es"} (primer base${n === 1 ? "" : "s"} ${site.mismatchPositions.join(", ")}, counted from its 5′ end)`;
  return `${site.start} to ${site.end}, ${site.strand} strand, ${mismatch}`;
}

/**
 * The span of a product on its reference and the sites that make it, in words.
 *
 * @param {{ length: number, start: number, end: number }} product
 */
export function productSpanText(product) {
  return `${product.length} bp, ${product.start} to ${product.end}`;
}

/**
 * The primers as a markdown table for the twin, with the computed columns beside the stored ones.
 *
 * @param {PrimerListRow[]} primers
 * @param {string} origin
 */
export function primersMarkdown(primers, origin) {
  const lines = primers.map(
    (p) =>
      `| [${cell(p.name)}](${origin}${p.path}) | \`${p.sequence ?? ""}\` | ${cell(p.direction)} | ${cell(p.target)} | ${cell(p.length)} | ${cell(p.tm)} | ${cell(productText(p.product))} |`,
  );
  return [
    "| Primer | Sequence (5′ to 3′) | Direction | Target | Length (nt) | Tm estimate (°C) | Product (computed) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...lines,
  ].join("\n");
}

/**
 * The Tm sentence, the sentence that says it is not an annealing temperature, and the calculator that gives one, in one
 * place for the page and the twin (protocols.md, 2026-10-04: no page presents a computed Tm as the annealing temperature).
 */
export function tmNote() {
  return { statement: tmStatement(), annealing: annealingSentence(), calculator: NEB_TM_CALCULATOR, conditions: TM_CONDITIONS };
}

/**
 * One primer as markdown for the twin: the same facts the page states, with the computed ones computed, and what could not be
 * found said with its reason rather than left out.
 *
 * @param {PrimerRow} primer
 * @param {PrimerRow[]} primers every published primer, for the mate and the pair's product
 * @param {Array<{ path: string, title: string }>} usedBy
 * @param {string} origin
 */
export function primerMarkdown(primer, primers, usedBy, origin) {
  const mate = mateOf(primer, primers);
  const pair = pairProduct(primer, primers);
  const published = primer.publishedIn
    ? `${primer.publishedIn}${primer.publishedDoi ? ` ([doi:${primer.publishedDoi}](https://doi.org/${primer.publishedDoi}))` : primer.publishedUrl ? ` (${primer.publishedUrl})` : ""}`
    : null;
  const lines = [
    primer.sequence ? `- Sequence (5′ to 3′): \`${primer.sequence}\`` : "",
    primer.reverseComplement ? `- Reverse complement (5′ to 3′): \`${primer.reverseComplement}\`` : "",
    primer.direction ? `- Direction: ${primer.direction}` : "",
    primer.target ? `- Target: ${primer.target}` : "",
    primer.set ? `- Set: ${primer.set}` : "",
    mate ? `- Pairs with: [${mate.name}](${origin}${mate.path})` : "",
    primer.length ? `- Length: ${primer.length} nt` : "",
    primer.gcPercent !== null ? `- GC content: ${primer.gcPercent}%` : "",
    primer.tm !== null ? `- Melting temperature estimate (Tm): ${primer.tm} °C` : "",
    `- Annealing temperature: depends on the polymerase; use the [${NEB_TM_CALCULATOR.name}](${NEB_TM_CALCULATOR.url})`,
    "",
    "## In the literature",
    "",
    `- Published in: ${published ?? `not found (${primer.publishedInMissing ?? "not recorded"})`}`,
    `- Name in the paper: ${primer.publishedName ?? `not found (${primer.publishedNameMissing ?? "not recorded"})`}`,
    primer.publishedSequence
      ? `- Sequence in the paper: \`${primer.publishedSequence}\` (${primer.matchesPublished ? "the stored sequence is identical" : "DIFFERS from the stored sequence"})`
      : `- Sequence in the paper: not found (${primer.publishedSequenceMissing ?? "not recorded"})`,
    primer.publishedProduct
      ? `- Product in the paper: ${primer.publishedProduct}`
      : primer.direction === "forward"
        ? `- Product in the paper: not found (${primer.publishedProductMissing ?? "not recorded"})`
        : "",
    "",
    "## On the reference",
    "",
    primer.placement
      ? `- Reference: ${primer.placement.reference.id} (${primer.placement.reference.description}), computed from the sequence`
      : primer.reference
        ? `- Reference: ${primer.reference}; the primer binds it nowhere within ${MAX_MISMATCHES} mismatches`
        : "- Reference: none recorded",
    ...(primer.placement ? primer.placement.sites.map((site) => `- Position: ${siteText(site)}`) : []),
    ...(pair ? pair.products.map((product) => `- Product (computed, with ${mate?.name ?? "its pair"}): ${productSpanText(product)}`) : []),
    "",
    ...usedBy.map((protocol) => `- Used in: [${protocol.title}](${origin}${protocol.path})`),
  ];
  return `# ${primer.name}\n\n${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n${primer.tm !== null ? `\n${tmNote().statement} ${tmNote().annealing}\n` : ""}`;
}
