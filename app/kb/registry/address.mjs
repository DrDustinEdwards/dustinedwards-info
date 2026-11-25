// Where the registry's pages sit and how an item's markdown twin reads (docs/REGISTRY.md): the lab root, a kind's page and an
// item's page, the library tabs, and the twin shape every kind shares.

import { KINDS } from "./kinds.mjs";

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
 * @param {string} segment
 * @param {Readonly<Record<string, import("./kinds.mjs").KindSpec>>} [kinds]
 */
export function kindFromSegment(segment, kinds = KINDS) {
  return Object.keys(kinds).find((kind) => kinds[kind]?.plural === segment) ?? null;
}

/**
 * @param {import("./kinds.mjs").RegistryItem[]} items
 * @param {Readonly<Record<string, import("./kinds.mjs").KindSpec>>} [kinds]
 */
export function registryTabs(items, kinds = KINDS) {
  return Object.keys(kinds).flatMap((kind) => {
    const count = items.filter((item) => item.kind === kind).length;
    const plural = kinds[kind]?.plural ?? kind;
    return count === 0
      ? []
      : [
          {
            id: plural,
            label: plural.charAt(0).toUpperCase() + plural.slice(1),
            count,
            href: kindPath(kind, kinds),
          },
        ];
  });
}

/** An item's markdown twin: its name as the title over the lines, with runs of blank lines collapsed. @param {string} name @param {string[]} lines */
export function itemTwin(name, lines) {
  return `# ${name}\n\n${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

/**
 * @param {string} kind
 * @param {Readonly<Record<string, import("./kinds.mjs").KindSpec>>} [kinds]
 */
export function hasItemPage(kind, kinds = KINDS) {
  return kinds[kind]?.itemPages !== false;
}
