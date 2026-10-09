// The reagent kind of the lab registry (docs/REGISTRY.md): the substances the lab's protocols use up, as distinct from the
// samples they work on (a lysate, soil, an eluate), the primers (their own kind) and the cultures (strains). A reagent has no
// page of its own: the reagents are one table (the library's Reagents tab), and each protocol's own Reagents table is drawn from
// these records with that protocol's amount, stock and final.
//
// A record states what the lab's own pages state about one substance: its name, an abbreviation or what it is made of where a
// protocol says so, and where it comes from. A BOUGHT reagent has a supplier and a catalog number (each stated, or
// `MISSING: <why>` where no record in the repository says, listed for Dustin) and a product link where a protocol linked it. A
// reagent PREPARED IN THE LAB says so (`prepared_in_lab: true`) and carries a link to its recipe in place of a supplier and a
// catalog number; the recipe is a procedure with the recipe profile, and where none exists yet the link is MISSING and listed for
// Dustin, because recipes are written by the lab and never invented here.
//
// What the protocols use of it is COMPUTED: a protocol names a reagent on one of its materials by id (`reagent: <id>`), keeps its
// own amount, stock and final, and the table lists the protocols that name it.

const LINE = /^[^\r\n]+$/;

/** @param {unknown} value @param {number} max */
const oneLine = (value, max) =>
  typeof value === "string" && LINE.test(value) && value === value.trim() && value.length <= max ? null : `is one line of at most ${max} characters`;

/** A field the file does not carry reads as null (compile.mjs). @param {unknown} value */
const absent = (value) => value === undefined || value === null;

/** @param {unknown} value */
const isGap = (value) => typeof value === "string" && value.startsWith("MISSING");

/** @type {import("./kinds.mjs").KindSpec} */
export const REAGENT = {
  singular: "reagent",
  plural: "reagents",
  // The reagents are one table, not a page each.
  itemPages: false,
  fields: {
    // What a protocol calls it in one phrase, as the protocols' own words give it: ZnCl2 for zinc chloride.
    abbreviation: { check: (value) => oneLine(value, 40) },
    // What it is made of, where a protocol says: DNase I plus RNase A.
    contents: { check: (value) => oneLine(value, 120) },
    // Bought (a supplier and a catalog number) or prepared in the lab (a recipe): setErrors holds each item to one of the two.
    supplier: { check: (value) => oneLine(value, 80) },
    catalog_number: { check: (value) => oneLine(value, 40) },
    product_url: { check: (value) => (typeof value === "string" && /^https:\/\/[^\s]+$/.test(value) ? null : "is an https address") },
    prepared_in_lab: { check: (value) => (value === true ? null : "is true, or absent for a reagent that is bought") },
    // The recipe of a reagent prepared in the lab: the file key of a procedure with the recipe profile, or MISSING.
    recipe: {
      check: async (value, { host }) =>
        typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && (await host.recipe(value))
          ? null
          : "is the file key of a procedure with the recipe profile (content/procedures/<key>.md, profile: recipe), or MISSING: <why>",
    },
  },
  /**
   * A bought reagent states a supplier and a catalog number (or a gap for each) and no recipe; a reagent prepared in the lab states
   * a recipe (or a gap) and no supplier, catalog number or product link, because it has none.
   */
  setErrors(items) {
    /** @type {string[]} */
    const errors = [];
    for (const { id, fields } of items) {
      if (fields.prepared_in_lab === true) {
        if (absent(fields.recipe)) errors.push(`reagent/${id} is prepared in the lab, so it states its recipe, or MISSING: <why>`);
        for (const field of ["supplier", "catalog_number", "product_url"]) {
          if (!absent(fields[field])) errors.push(`reagent/${id} is prepared in the lab, so it has no ${field}`);
        }
      } else {
        for (const field of ["supplier", "catalog_number"]) {
          if (absent(fields[field])) errors.push(`reagent/${id} is bought, so it states its ${field}, or MISSING: <why>`);
        }
        if (!absent(fields.recipe) && !isGap(fields.recipe)) errors.push(`reagent/${id} is not prepared in the lab, so it has no recipe`);
      }
    }
    return errors;
  },
};

/**
 * A reagent as a protocol carries it (`StoredReagent` in app/kb/procedures/render.mjs): the registry's stated facts, none computed,
 * so the protocol's Reagents table, twin and frozen versions say where each came from as it was when the protocol was published.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render.mjs").StoredReagent}
 */
export function storedReagent(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  const text = (/** @type {unknown} */ value) => (typeof value === "string" && value !== "" && !value.startsWith("MISSING") ? value : null);
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    preparedInLab: f.prepared_in_lab === true,
    supplier: text(f.supplier),
    catalogNumber: text(f.catalog_number),
    productUrl: text(f.product_url),
    recipe: text(f.recipe),
  };
}
