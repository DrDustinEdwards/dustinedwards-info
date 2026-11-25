// The primers catalog (docs/REGISTRY.md): a primer's row and what is computed from its sequence, the pairs, and the markdown twins.
// Nothing computed is stored: length, GC content, reverse complement and Tm come from the sequence.

import { mdLink } from "../md-link.mjs";
import { defineCatalog } from "capsomer/behavior/catalog";
import { reverseComplement } from "../../lib/primers.mjs";
import { MAX_MISMATCHES, pairProducts, placePrimer } from "./align.mjs";
import { missingReason, primerFacts, stated } from "./primer.mjs";
import { NEB_TM_CALCULATOR, TM_CONDITIONS, annealingSentence, tmStatement } from "./tm.mjs";
import { mdCell, plural } from "@drdustinedwards/site-helpers/text";
import { itemPath, itemTwin, kindPath } from "./address.mjs";

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

export const DIRECTION_LABELS = /** @type {Record<string, string>} */ ({
  forward: "Forward",
  reverse: "Reverse",
  probe: "Probe",
});

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
  return pair.products.length > 1 && sizes.length === 1
    ? `${text} at ${pair.products.length} sites`
    : text;
}

/** The primers catalog: the columns a primer is read by, which are its own and not a protocol's. */
export const PRIMERS = defineCatalog(
  /** @type {import("capsomer/behavior/catalog").CatalogDefinition<PrimerListRow>} */ ({
    id: "primers",
    noun: ["primer", "primers"],
    basePath: kindPath("primer"),
    itemKey: (p) => p.id,
    defaultSort: "name",
    pageSize: 25,
    fields: [
      {
        key: "name",
        label: "Primer",
        value: (p) => p.name,
        search: 3,
        column: { header: "Primer" },
        sort: true,
      },
      {
        key: "sequence",
        label: "Sequence (5′ to 3′)",
        value: (p) => p.sequence ?? "",
        search: 2,
        column: { header: "Sequence (5′ to 3′)", drop: 1 },
      },
      {
        key: "direction",
        label: "Direction",
        value: (p) => p.direction,
        facet: { kind: "many", general: true, label: (value) => DIRECTION_LABELS[value] ?? value },
        column: { header: "Direction", drop: 2 },
      },
      {
        key: "target",
        label: "Target",
        value: (p) => p.target,
        facet: { kind: "many", order: "alpha" },
        search: 2,
        column: { header: "Target", drop: 1 },
      },
      { key: "set", label: "Set", value: (p) => p.set, search: 1 },
      {
        key: "length",
        label: "Length (nt)",
        value: (p) => p.length,
        type: "number",
        sort: true,
        column: { header: "Length (nt)", align: "end", drop: 2 },
      },
      {
        key: "tm",
        label: "Tm estimate (°C)",
        value: (p) => p.tm,
        type: "number",
        sort: true,
        column: { header: "Tm estimate (°C)", align: "end", drop: 2 },
      },
      {
        key: "product",
        label: "Product (computed)",
        value: (p) => productText(p.product),
        column: { header: "Product (computed)", drop: 2 },
      },
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
  return (
    primers.find(
      (p) => p.id !== primer.id && p.set === primer.set && p.direction !== primer.direction,
    ) ?? null
  );
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
  if (
    !mate ||
    !primer.sequence ||
    !mate.sequence ||
    !primer.reference ||
    primer.reference !== mate.reference
  )
    return null;
  const forward = primer.direction === "forward" ? primer : mate;
  const reverse = primer.direction === "forward" ? mate : primer;
  if (
    forward.direction !== "forward" ||
    reverse.direction !== "reverse" ||
    !forward.sequence ||
    !reverse.sequence
  )
    return null;
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
      : `${plural(n, "mismatch", "mismatches")} (primer base${n === 1 ? "" : "s"} ${site.mismatchPositions.join(", ")}, counted from its 5′ end)`;
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
      `| [${mdCell(p.name)}](${origin}${p.path}) | \`${p.sequence ?? ""}\` | ${mdCell(p.direction)} | ${mdCell(p.target)} | ${mdCell(p.length)} | ${mdCell(p.tm)} | ${mdCell(productText(p.product))} |`,
  );
  return [
    "| Primer | Sequence (5′ to 3′) | Direction | Target | Length (nt) | Tm estimate (°C) | Product (computed) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...lines,
  ].join("\n");
}

/**
 * The Tm sentence, the sentence that says it is not an annealing temperature, and the calculator that gives one, in one
 * place for the page and the twin (test/registry-tm.test.mjs: no page presents a computed Tm as the annealing temperature).
 */
export function tmNote() {
  return {
    statement: tmStatement(),
    annealing: annealingSentence(),
    calculator: NEB_TM_CALCULATOR,
    conditions: TM_CONDITIONS,
  };
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
    primer.reverseComplement
      ? `- Reverse complement (5′ to 3′): \`${primer.reverseComplement}\``
      : "",
    primer.direction ? `- Direction: ${primer.direction}` : "",
    primer.target ? `- Target: ${primer.target}` : "",
    primer.set ? `- Set: ${primer.set}` : "",
    mate ? `- Pairs with: ${mdLink(mate.name, origin + mate.path)}` : "",
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
    ...(primer.placement
      ? primer.placement.sites.map((site) => `- Position: ${siteText(site)}`)
      : []),
    ...(pair
      ? pair.products.map(
          (product) =>
            `- Product (computed, with ${mate?.name ?? "its pair"}): ${productSpanText(product)}`,
        )
      : []),
    "",
    ...usedBy.map((protocol) => `- Used in: ${mdLink(protocol.title, origin + protocol.path)}`),
  ];
  return `${itemTwin(primer.name, lines)}${primer.tm !== null ? `\n${tmNote().statement} ${tmNote().annealing}\n` : ""}`;
}
