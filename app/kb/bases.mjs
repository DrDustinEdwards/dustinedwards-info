// The knowledge bases (docs/KNOWLEDGE-BASE.md): one entry per base, each the procedures of one profile with the
// address root its entries live under and the address of its library. The software how-tos live under /software
// (DECIDE 4), the library and its entries both. Declared once here; the procedure validator's roots and the route table read it,
// so a base's address is never typed twice. A list in code, not a table (Dustin, 2026-10-09): a base is nothing
// without its profile's components, and those are code.

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   singular: string,
 *   profile: "protocol" | "recipe" | "computational",
 *   entryRoot: string,
 *   library: string,
 * }} KnowledgeBase
 */

/** @type {readonly KnowledgeBase[]} */
export const BASES = Object.freeze([
  { id: "protocols", name: "Protocols", singular: "Protocol", profile: "protocol", entryRoot: "/research/protocols/", library: "/research/protocols" },
  { id: "how-tos", name: "Software how-tos", singular: "Software how-to", profile: "computational", entryRoot: "/software/how-tos/", library: "/software/how-tos" },
  { id: "recipes", name: "Recipes", singular: "Recipe", profile: "recipe", entryRoot: "/recipes/", library: "/recipes" },
]);
