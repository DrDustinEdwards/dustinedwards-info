/** The lab-registry rows a protocol carries, stored in its record when it is compiled (docs/REGISTRY.md), and where a reagent comes from. */

/**
 * A primer as a protocol carries it: the lab registry's own facts about it, read when the protocol is compiled and stored
 * in the record, so the page, the sheet, the twin and a frozen version all print the same sequence, and the protocol's
 * file holds none (docs/REGISTRY.md). Its Tm and length are computed from the sequence where they are shown.
 *
 * @typedef {{ id: string, name: string, status: "published" | "draft", set: string | null, direction: string | null, sequence: string | null, reference: string | null, publishedIn?: string | null }} StoredPrimer
 */

/**
 * A host strain as a protocol carries it: the lab registry's stated facts about it, read when the protocol is compiled and
 * stored in the record, so the page, the twin and a frozen version name one strain and the protocol's file types none.
 *
 * A reagent as a protocol carries it: the lab registry's name for it, read when the protocol is compiled, so a material that
 * names a reagent shows the registry's name and links its page and a frozen version keeps the name it was published with.
 *
 * An equipment item as a protocol carries it: the registry's stated facts (who makes it, and a centrifuge's rotor, or that the rotor
 * is a recorded gap), read when the protocol is compiled, so the protocol's Equipment table and twin say as it was published.
 *
 * @typedef {{ id: string, name: string, status: "published" | "draft", manufacturer: string | null, rotor: string | null, rotorGap: boolean }} StoredEquipment
 *
 * @typedef {{ id: string, name: string, status: "published" | "draft", preparedInLab: boolean, supplier: string | null, catalogNumber: string | null, productUrl: string | null, recipe: string | null }} StoredReagent
 *
 * @typedef {{ id: string, name: string, status: "published" | "draft", organism: string | null, strain: string | null, collection: string | null, collectionNumber: string | null }} StoredStrain
 */

/**
 * @param {StoredReagent} reagent
 * @returns {{ text: string, href: string | null }}
 */
export function reagentSource(reagent) {
  if (reagent.preparedInLab) {
    return {
      text: reagent.recipe ? "Prepared in the lab (recipe)" : "Prepared in the lab",
      href: reagent.recipe ? `/recipes/${reagent.recipe}` : null,
    };
  }
  const text = [reagent.supplier, reagent.catalogNumber].filter(Boolean).join(", ");
  return { text: text || "Not recorded", href: reagent.productUrl };
}
