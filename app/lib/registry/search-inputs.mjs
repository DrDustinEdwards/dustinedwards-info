// What the site's search finds for a registry item (docs/REGISTRY.md): one record per published item, so a search for a primer's
// sequence, its target, its reference or the paper that prints it finds the primer's own page as well as the protocols that use
// it. The record is derived from the item and nothing else, so a save, sync_registry and sync:content write the same text, and a
// draft has none. Like a paper's, it is one record with no deep links: an item has no sections to link to.

import { itemPath, primerRow, siteText } from "./catalog.mjs";
import { stated } from "./primer.mjs";
import { designationOf } from "./strain.mjs";

/** The item's search uid: a removal needs it to find the item's record. @param {string} kind @param {string} id */
export function registrySearchUid(kind, id) {
  // The registry: namespace keeps these uids separable from hand-authored pages and papers when search_docs is pruned.
  return `registry:${kind}/${id}`;
}

/**
 * The words a primer is searched by: what it is, its sequence and reverse complement (a sequence search finds either strand),
 * where it binds, and the paper that prints it. Only facts the record states or computes; a fact that could not be found is
 * not a word to find.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 */
function primerBody(item) {
  const row = primerRow(item);
  return [
    row.name,
    row.direction ? `${row.direction} primer` : "primer",
    row.sequence,
    row.reverseComplement,
    row.target,
    row.set,
    row.length ? `${row.length} nt` : null,
    row.placement ? `${row.placement.reference.id} ${row.placement.reference.description}` : null,
    ...(row.placement ? row.placement.sites.map(siteText) : []),
    row.publishedIn,
    row.publishedDoi,
    row.publishedName,
    row.publishedSequence,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The words a strain is searched by: its organism, designation, collection and number. The phages isolated on it are the
 * phages table's own records and are not copied into this one.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 */
function strainBody(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return [item.name, "strain", "host", stated(f.organism), designationOf(f), stated(f.collection), stated(f.collection_number)].filter(Boolean).join(" ");
}

/**
 * The words a reagent is searched by: its name, abbreviation, contents, supplier and catalog number. The protocols that use
 * it are the protocols' own records and are not copied into this one.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 */
function reagentBody(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return [item.name, "reagent", stated(f.abbreviation), stated(f.contents), stated(f.supplier), stated(f.catalog_number)].filter(Boolean).join(" ");
}

/**
 * The record input of one item, or null for a kind with no search body yet (so a kind added later is not indexed by accident).
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {{ uid: string, url: string, title: string, body: string } | null}
 */
export function registrySearchInput(item) {
  const body = item.kind === "primer" ? primerBody(item) : item.kind === "strain" ? strainBody(item) : item.kind === "reagent" ? reagentBody(item) : null;
  if (body === null) return null;
  return { uid: registrySearchUid(item.kind, item.id), url: itemPath(item.kind, item.id), title: item.name, body };
}

/** The inputs of every published item that has one, for the build's search artifact. @param {import("./kinds.mjs").RegistryItem[]} items */
export function registrySearchInputs(items) {
  return items.flatMap((item) => {
    if (item.status === "draft") return [];
    const input = registrySearchInput(item);
    return input ? [input] : [];
  });
}
