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
import { primerFacts } from "./primer.mjs";
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

/** A field as text: a recorded gap (MISSING: why) and an absent value are both nothing to show. @param {unknown} value */
export function stated(value) {
  return typeof value === "string" && value !== "" && !value.startsWith("MISSING") ? value : null;
}

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
 * A primer as the pages read it: the record's own fields, and what is computed from its sequence.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 */
export function primerRow(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  const sequence = stated(f.sequence);
  const facts = sequence ? primerFacts(sequence) : { length: null, gcPercent: null, tm: null };
  return {
    id: item.id,
    path: itemPath("primer", item.id),
    name: item.name,
    sequence,
    reverseComplement: sequence && /^[ACGT]+$/.test(sequence) ? reverseComplement(sequence) : null,
    direction: stated(f.direction),
    target: stated(f.target),
    set: stated(f.set),
    product: stated(f.product),
    source: stated(f.source),
    sourceUrl: stated(f.source_url),
    paper: stated(f.paper),
    length: facts.length,
    gcPercent: facts.gcPercent,
    tm: facts.tm,
    draft: item.status === "draft",
  };
}

/** @typedef {ReturnType<typeof primerRow>} PrimerRow */

const DIRECTION_LABELS = /** @type {Record<string, string>} */ ({ forward: "Forward", reverse: "Reverse", probe: "Probe" });

/** The primers catalog: the columns a primer is read by, which are its own and not a protocol's. */
export const PRIMERS = defineCatalog(
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<PrimerRow>} */ ({
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
      { key: "product", label: "Product", value: (p) => p.product, column: { header: "Product", drop: 2 } },
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
 * The product of a primer's pair: stated on the forward primer, read from the pair for the reverse one, so it is stored
 * once and shown on both.
 *
 * @param {PrimerRow} primer
 * @param {PrimerRow[]} primers
 */
export function pairProduct(primer, primers) {
  return primer.product ?? mateOf(primer, primers)?.product ?? null;
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
 * The primers as a markdown table for the twin, with the computed columns beside the stored ones.
 *
 * @param {PrimerRow[]} primers
 * @param {string} origin
 */
export function primersMarkdown(primers, origin) {
  const lines = primers.map(
    (p) =>
      `| [${cell(p.name)}](${origin}${p.path}) | \`${p.sequence ?? ""}\` | ${cell(p.direction)} | ${cell(p.target)} | ${cell(p.length)} | ${cell(p.tm)} | ${cell(pairProduct(p, primers))} |`,
  );
  return [
    "| Primer | Sequence (5′ to 3′) | Direction | Target | Length (nt) | Tm estimate (°C) | Product |",
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
 * One primer as markdown for the twin: the same facts the page states, with the computed ones computed.
 *
 * @param {PrimerRow} primer
 * @param {PrimerRow[]} primers every published primer, for the mate and the pair's product
 * @param {Array<{ path: string, title: string }>} usedBy
 * @param {string} origin
 */
export function primerMarkdown(primer, primers, usedBy, origin) {
  const mate = mateOf(primer, primers);
  const product = pairProduct(primer, primers);
  const lines = [
    primer.sequence ? `- Sequence (5′ to 3′): \`${primer.sequence}\`` : "",
    primer.reverseComplement ? `- Reverse complement (5′ to 3′): \`${primer.reverseComplement}\`` : "",
    primer.direction ? `- Direction: ${primer.direction}` : "",
    primer.target ? `- Target: ${primer.target}` : "",
    primer.set ? `- Set: ${primer.set}` : "",
    mate ? `- Pairs with: [${mate.name}](${origin}${mate.path})` : "",
    product ? `- Product: ${product}` : "",
    primer.length ? `- Length: ${primer.length} nt` : "",
    primer.gcPercent !== null ? `- GC content: ${primer.gcPercent}%` : "",
    primer.tm !== null ? `- Melting temperature estimate (Tm): ${primer.tm} °C` : "",
    `- Annealing temperature: depends on the polymerase; use the [${NEB_TM_CALCULATOR.name}](${NEB_TM_CALCULATOR.url})`,
    primer.source ? `- Source: ${primer.sourceUrl ? `[${primer.source}](${primer.sourceUrl})` : primer.source}` : "",
    primer.paper ? `- On this site: [${primer.source ?? primer.paper}](${origin}/research/publications/${primer.paper}/)` : "",
    ...usedBy.map((protocol) => `- Used in: [${protocol.title}](${origin}${protocol.path})`),
  ].filter(Boolean);
  return `# ${primer.name}\n\n${lines.join("\n")}\n${primer.tm !== null ? `\n${tmNote().statement} ${tmNote().annealing}\n` : ""}`;
}
