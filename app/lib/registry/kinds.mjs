// The kinds the lab registry holds (docs/REGISTRY.md). A kind is data here, not a branch in the compile: its label,
// its address and the fields it knows beyond the ones every item has (name and status). The compile
// (compile.mjs), the save, the sync, the drift check and Carrel's handlers all read this one object, so a kind
// added here is a kind every one of them serves.
//
// The registry shipped as a framework with no kind (job_915d43f44cee), and each kind arrives with its own records and
// pages in its own change: primer, then strain, then reagent and equipment.

import { EQUIPMENT } from "./equipment.mjs";
import { PRIMER } from "./primer.mjs";
import { REAGENT } from "./reagent.mjs";
import { STRAIN } from "./strain.mjs";

/**
 * What a kind says about one field. `check` returns a message when the value is wrong and null when it is right; it
 * may be async (a field that names a publication asks the host). A value written "MISSING: <why>" is a recorded gap
 * and skips `check`, as in a procedure.
 *
 * @typedef {{
 *   required?: boolean,
 *   check: (value: unknown, context: RegistryContext) => string | null | Promise<string | null>,
 * }} FieldSpec
 *
 * @typedef {{
 *   singular: string,
 *   plural: string,
 *   itemPages?: boolean,
 *   fields: Record<string, FieldSpec>,
 *   setErrors?: (items: RegistryItem[]) => string[],
 * }} KindSpec
 *
 * What the host can answer for a file the repository holds, so the Worker (reading GitHub) and Node (reading the
 * clone) judge a file the same way. `paper` is whether the site holds a publication with that file key, and `recipe` whether the site holds a procedure with the
 * recipe profile under that file key.
 *
 * @typedef {{ paper: (slug: string) => Promise<boolean>, recipe: (slug: string) => Promise<boolean> }} RegistryHost
 * @typedef {{ host: RegistryHost, data: Record<string, unknown> }} RegistryContext
 *
 * One item as the table holds it: the shared columns and the kind's own fields, `null` where a kind's field is
 * absent. `fields` never repeats a shared column.
 *
 * @typedef {{ kind: string, id: string, name: string, status: "published" | "draft", fields: Record<string, unknown> }} RegistryItem
 */

/** @type {Readonly<Record<string, KindSpec>>} */
export const KINDS = Object.freeze({ primer: PRIMER, strain: STRAIN, reagent: REAGENT, equipment: EQUIPMENT });

/** The kinds in the order the site lists them, which is the order they are defined in. @param {Record<string, KindSpec>} [kinds] */
export function kindKeys(kinds = KINDS) {
  return Object.keys(kinds);
}
