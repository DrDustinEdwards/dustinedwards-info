// The knowledge bases (docs/KNOWLEDGE-BASE.md): one entry per base, each the procedures of one profile with the
// address root its entries live under. Declared once here; the procedure validator's roots and the route table read it,
// so a base's address is never typed twice. A list in code, not a table (Dustin, 2026-10-09): a base is nothing
// without its profile's components, and those are code.

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   profile: "protocol" | "recipe" | "computational",
 *   entryRoot: string,
 * }} KnowledgeBase
 */

/** @type {readonly KnowledgeBase[]} */
export const BASES = Object.freeze([
  { id: "protocols", name: "Protocols", profile: "protocol", entryRoot: "/research/protocols/" },
  { id: "how-tos", name: "Software how-tos", profile: "computational", entryRoot: "/research/methods/" },
  { id: "recipes", name: "Recipes", profile: "recipe", entryRoot: "/recipes/" },
]);
