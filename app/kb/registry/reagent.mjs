// The reagent kind of the lab registry (docs/REGISTRY.md): the substances protocols use up, as distinct from
// samples, primers and strains. One table, a page each, listing the protocols that use it.
// A BOUGHT reagent has a supplier and catalog number (stated, or `MISSING: <why>`); a reagent PREPARED IN
// THE LAB (`prepared_in_lab: true`) links its recipe procedure instead, MISSING where none exists, because
// recipes are written by the lab and never invented here. What protocols use of it is COMPUTED: they name
// it by id on a material and keep their own amount, stock and final.

import { SLUG_PATTERN } from "@drdustinedwards/site-helpers/slug";

import { isGap } from "../procedures/gap.mjs";
import { httpsUrl, oneLine, stated } from "./primer.mjs";

/** A field the file does not carry reads as null (compile.mjs). @param {unknown} value */
const absent = (value) => value === undefined || value === null;

/** @type {import("./kinds.mjs").KindSpec} */
export const REAGENT = {
  singular: "reagent",
  plural: "reagents",
  fields: {
    // What a protocol calls it in one phrase, as the protocols' own words give it: ZnCl2 for zinc chloride.
    abbreviation: { check: (value) => oneLine(value, 40) },
    // What it is made of, where a protocol says: DNase I plus RNase A.
    contents: { check: (value) => oneLine(value, 120) },
    // Bought (a supplier and a catalog number) or prepared in the lab (a recipe): setErrors holds each item to one of the two.
    supplier: { check: (value) => oneLine(value, 80) },
    catalog_number: { check: (value) => oneLine(value, 40) },
    product_url: { check: httpsUrl },
    prepared_in_lab: {
      check: (value) => (value === true ? null : "is true, or absent for a reagent that is bought"),
    },
    // The recipe of a reagent prepared in the lab: the file key of a procedure with the recipe profile, or MISSING.
    recipe: {
      check: async (value, { host }) =>
        typeof value === "string" && SLUG_PATTERN.test(value) && (await host.recipe(value))
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
        if (absent(fields.recipe))
          errors.push(
            `reagent/${id} is prepared in the lab, so it states its recipe, or MISSING: <why>`,
          );
        for (const field of ["supplier", "catalog_number", "product_url"]) {
          if (!absent(fields[field]))
            errors.push(`reagent/${id} is prepared in the lab, so it has no ${field}`);
        }
      } else {
        for (const field of ["supplier", "catalog_number"]) {
          if (absent(fields[field]))
            errors.push(`reagent/${id} is bought, so it states its ${field}, or MISSING: <why>`);
        }
        if (!absent(fields.recipe) && !isGap(fields.recipe))
          errors.push(`reagent/${id} is not prepared in the lab, so it has no recipe`);
      }
    }
    return errors;
  },
};

/**
 * A reagent as a protocol carries it (`StoredReagent` in app/kb/procedures/render-stored.mjs): the registry's stated facts, none computed,
 * so the protocol's Reagents table, twin and frozen versions say where each came from as it was when the protocol was published.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render-stored.mjs").StoredReagent}
 */
export function storedReagent(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    preparedInLab: f.prepared_in_lab === true,
    supplier: stated(f.supplier),
    catalogNumber: stated(f.catalog_number),
    productUrl: stated(f.product_url),
    recipe: stated(f.recipe),
  };
}
