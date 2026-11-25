// The reagents and equipment catalogs (docs/REGISTRY.md): each item's row with the protocols that use it, and the markdown twins.

import { mdLink } from "../md-link.mjs";
import { defineCatalog } from "capsomer/behavior/catalog";
import { missingReason, stated } from "./primer.mjs";
import { mdCell } from "@drdustinedwards/site-helpers/text";
import { itemPath, itemTwin, kindPath } from "./address.mjs";

/**
 * Where a procedure with the recipe profile is: a recipe's address is under /recipes (PROFILE_ROOTS in the procedure validator).
 *
 * @param {string} slug
 */
function recipePath(slug) {
  return `/recipes/${slug}`;
}

/**
 * What the protocols use of a reagent, read from the protocols that name it on one of their materials (`reagent: <id>`): the
 * protocols only, since a protocol's own amounts, stocks and finals are shown in that protocol's table. Nothing is stored on the
 * reagent, so a protocol that names it later is listed with no edit to the record.
 *
 * @param {string} id
 * @param {Array<{ path: string, title: string, materials?: Array<{ reagent?: { id: string } | null }> }>} protocols
 */
function reagentUses(id, protocols) {
  return protocols
    .filter((protocol) => (protocol.materials ?? []).some((m) => m.reagent?.id === id))
    .map((protocol) => ({ path: protocol.path, title: protocol.title }));
}

/**
 * A reagent as the pages read it: the record's own fields and the protocols that use it, computed from the protocols. A reagent is
 * bought (a supplier and a catalog number, each stated or a gap with its reason) or prepared in the lab (a recipe, which is a
 * procedure with the recipe profile, or a gap with its reason).
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @param {Parameters<typeof reagentUses>[1]} [protocols]
 */
export function reagentRow(item, protocols = []) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  const prepared = f.prepared_in_lab === true;
  const recipe = stated(f.recipe);
  return {
    id: item.id,
    name: item.name,
    path: itemPath("reagent", item.id),
    abbreviation: stated(f.abbreviation),
    contents: stated(f.contents),
    preparedInLab: prepared,
    supplier: stated(f.supplier),
    supplierMissing: missingReason(f.supplier),
    catalogNumber: stated(f.catalog_number),
    catalogNumberMissing: missingReason(f.catalog_number),
    productUrl: stated(f.product_url),
    recipe,
    recipePath: recipe ? recipePath(recipe) : null,
    recipeMissing: missingReason(f.recipe),
    uses: reagentUses(item.id, protocols),
    draft: item.status === "draft",
  };
}

/** @typedef {ReturnType<typeof reagentRow>} ReagentRow */

/** The reagents as rows, each with the protocols that use it. @param {import("./kinds.mjs").RegistryItem[]} items @param {Parameters<typeof reagentUses>[1]} protocols */
export function reagentRows(items, protocols) {
  return items.filter((item) => item.kind === "reagent").map((item) => reagentRow(item, protocols));
}

/** The name as the table shows it: the abbreviation or what it is made of beside it, where a protocol states one. @param {ReagentRow} r */
export function reagentLabel(r) {
  const more = [r.abbreviation, r.contents].filter(Boolean).join("; ");
  return more ? `${r.name} (${more})` : r.name;
}

/** The "supplier" cell in words: who makes a bought reagent, or that the lab prepares it. @param {ReagentRow} r */
export function reagentSource(r) {
  return r.preparedInLab ? "Prepared in lab" : r.supplier;
}

/** The reagents catalog: the one table, with the columns a reagent is read by. */
export const REAGENTS = defineCatalog(
  /** @type {import("capsomer/behavior/catalog").CatalogDefinition<ReagentRow>} */ ({
    id: "reagents",
    noun: ["reagent", "reagents"],
    basePath: kindPath("reagent"),
    itemKey: (r) => r.id,
    defaultSort: "name",
    pageSize: 50,
    fields: [
      {
        key: "name",
        label: "Reagent",
        value: (r) => reagentLabel(r),
        search: 3,
        column: { header: "Reagent" },
        sort: true,
      },
      {
        key: "supplier",
        label: "Supplier",
        value: (r) => reagentSource(r),
        facet: { kind: "many", order: "alpha" },
        search: 1,
        column: { header: "Supplier", drop: 1 },
      },
      {
        key: "number",
        label: "Catalog number",
        value: (r) => r.catalogNumber,
        search: 2,
        column: { header: "Catalog number", drop: 1 },
      },
      {
        key: "link",
        label: "Link",
        value: (r) => r.productUrl ?? r.recipePath,
        column: { header: "Link", drop: 2 },
      },
      {
        key: "protocols",
        label: "Protocols",
        value: (r) => r.uses.map((u) => u.title).join("; "),
        search: 1,
        column: { header: "Protocols", drop: 2 },
      },
    ],
  }),
);

/** What a reagent's cells say where the record states nothing, with the reason, so a gap is listed and not left blank. @param {ReagentRow} r */
function reagentGapText(r) {
  const parts = [];
  if (!r.preparedInLab && !r.supplier)
    parts.push(`supplier: ${r.supplierMissing ?? "not recorded"}`);
  if (!r.preparedInLab && !r.catalogNumber)
    parts.push(`catalog number: ${r.catalogNumberMissing ?? "not recorded"}`);
  if (r.preparedInLab && !r.recipe) parts.push(`recipe: ${r.recipeMissing ?? "not recorded"}`);
  return parts;
}

/**
 * The reagents as one markdown table for the twin, then every gap with its reason, so a machine reads what a person sees and what
 * is still missing.
 *
 * @param {ReagentRow[]} reagents
 * @param {string} origin
 */
export function reagentsMarkdown(reagents, origin) {
  const link = (/** @type {ReagentRow} */ r) =>
    r.productUrl
      ? `[product](${r.productUrl})`
      : r.recipePath
        ? `[recipe](${origin}${r.recipePath})`
        : "";
  const uses = (/** @type {ReagentRow} */ r) =>
    r.uses.map((u) => mdLink(u.title, origin + u.path)).join(", ");
  const lines = reagents.map(
    (r) =>
      `| ${mdCell(reagentLabel(r))} | ${mdCell(reagentSource(r))} | ${mdCell(r.catalogNumber)} | ${link(r)} | ${uses(r)} |`,
  );
  const gaps = reagents.flatMap((r) => reagentGapText(r).map((text) => `- ${r.name}, ${text}`));
  return [
    "| Reagent | Supplier | Catalog number | Link | Protocols |",
    "| --- | --- | --- | --- | --- |",
    ...lines,
    ...(gaps.length > 0 ? ["", "Not found:", "", ...gaps] : []),
  ].join("\n");
}

/**
 * One reagent as markdown for its item twin: the same facts as its page, every gap with its reason, and the protocols that use it.
 *
 * @param {ReagentRow} r
 * @param {string} origin
 */
export function reagentItemMarkdown(r, origin) {
  const lines = [
    r.abbreviation ? `- Abbreviation: ${r.abbreviation}` : "",
    r.contents ? `- Contents: ${r.contents}` : "",
    r.preparedInLab
      ? `- Source: prepared in the lab${r.recipePath ? `, [recipe](${origin}${r.recipePath})` : `; recipe not found (${r.recipeMissing ?? "not recorded"})`}`
      : `- Supplier: ${r.supplier ?? `not found (${r.supplierMissing ?? "not recorded"})`}`,
    r.preparedInLab
      ? ""
      : `- Catalog number: ${r.catalogNumber ?? `not found (${r.catalogNumberMissing ?? "not recorded"})`}`,
    r.productUrl ? `- Product page: ${r.productUrl}` : "",
    "",
    ...r.uses.map((u) => `- Used in: ${mdLink(u.title, origin + u.path)}`),
  ];
  return itemTwin(r.name, lines);
}

/**
 * What the protocols do with an item, read from the protocols that name it in their equipment list (`equipment: <id>`). Nothing is
 * stored on the item, so a protocol that names it later is listed with no edit to the record.
 *
 * @param {string} id
 * @param {Array<{ path: string, title: string, equipment?: Array<{ name: string, item?: { id: string } | null }> }>} protocols
 */
export function equipmentUses(id, protocols) {
  return protocols
    .filter((protocol) => (protocol.equipment ?? []).some((e) => e.item?.id === id))
    .map((protocol) => ({ path: protocol.path, title: protocol.title }));
}

/**
 * An equipment item as the pages read it: the record's own fields, with a maker or rotor nobody has recorded said with its reason,
 * and the protocols that use it, computed from the protocols.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @param {Parameters<typeof equipmentUses>[1]} [protocols]
 */
export function equipmentRow(item, protocols = []) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return {
    id: item.id,
    name: item.name,
    path: itemPath("equipment", item.id),
    manufacturer: stated(f.manufacturer),
    manufacturerMissing: missingReason(f.manufacturer),
    rotor: stated(f.rotor),
    rotorMissing: missingReason(f.rotor),
    uses: equipmentUses(item.id, protocols),
    draft: item.status === "draft",
  };
}

/** @typedef {ReturnType<typeof equipmentRow>} EquipmentRow */

/** The equipment as rows, each with the protocols that use it. @param {import("./kinds.mjs").RegistryItem[]} items @param {Parameters<typeof equipmentUses>[1]} protocols */
export function equipmentRows(items, protocols) {
  return items
    .filter((item) => item.kind === "equipment")
    .map((item) => equipmentRow(item, protocols));
}

/** The equipment catalog: the one table, with the columns an item is read by. */
export const EQUIPMENT_CATALOG = defineCatalog(
  /** @type {import("capsomer/behavior/catalog").CatalogDefinition<EquipmentRow>} */ ({
    id: "equipment",
    noun: ["item", "items"],
    basePath: kindPath("equipment"),
    itemKey: (e) => e.id,
    defaultSort: "name",
    pageSize: 50,
    fields: [
      {
        key: "name",
        label: "Equipment",
        value: (e) => e.name,
        search: 3,
        column: { header: "Equipment" },
        sort: true,
      },
      {
        key: "manufacturer",
        label: "Manufacturer",
        value: (e) => e.manufacturer,
        facet: { kind: "many", order: "alpha" },
        search: 1,
        column: { header: "Manufacturer", drop: 1 },
      },
      {
        key: "rotor",
        label: "Rotor",
        value: (e) => e.rotor,
        search: 1,
        column: { header: "Rotor", drop: 2 },
      },
      {
        key: "protocols",
        label: "Protocols",
        value: (e) => e.uses.map((u) => u.title).join("; "),
        search: 1,
        column: { header: "Protocols", drop: 1 },
      },
    ],
  }),
);

/** What an item's cells say where the record states nothing, with the reason. @param {EquipmentRow} e */
function equipmentGapText(e) {
  const parts = [];
  if (!e.manufacturer) parts.push(`manufacturer: ${e.manufacturerMissing ?? "not recorded"}`);
  if (!e.rotor && e.rotorMissing) parts.push(`rotor: ${e.rotorMissing}`);
  return parts;
}

/**
 * The equipment as one markdown table for the twin, then every gap with its reason, so a machine reads what a person sees and what
 * is still missing.
 *
 * @param {EquipmentRow[]} items
 * @param {string} origin
 */
export function equipmentMarkdown(items, origin) {
  const uses = (/** @type {EquipmentRow} */ e) =>
    e.uses.map((u) => mdLink(u.title, origin + u.path)).join(", ");
  const lines = items.map(
    (e) => `| ${mdCell(e.name)} | ${mdCell(e.manufacturer)} | ${mdCell(e.rotor)} | ${uses(e)} |`,
  );
  const gaps = items.flatMap((e) => equipmentGapText(e).map((text) => `- ${e.name}, ${text}`));
  return [
    "| Equipment | Manufacturer | Rotor | Protocols |",
    "| --- | --- | --- | --- |",
    ...lines,
    ...(gaps.length > 0 ? ["", "Not found:", "", ...gaps] : []),
  ].join("\n");
}

/**
 * One item of equipment as markdown for its item twin: who makes it, a centrifuge's rotor, every gap with its reason, and the
 * protocols that use it.
 *
 * @param {EquipmentRow} e
 * @param {string} origin
 */
export function equipmentItemMarkdown(e, origin) {
  const lines = [
    `- Manufacturer: ${e.manufacturer ?? `not found (${e.manufacturerMissing ?? "not recorded"})`}`,
    e.rotor
      ? `- Rotor: ${e.rotor}`
      : e.rotorMissing
        ? `- Rotor: not found (${e.rotorMissing})`
        : "",
    "",
    ...e.uses.map((u) => `- Used in: ${mdLink(u.title, origin + u.path)}`),
  ];
  return itemTwin(e.name, lines);
}
