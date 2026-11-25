/** Scalable quantities: the slot a step's HTML leaves for each, the factor a request asks for, and filling the slots. */

import { formatQuantity } from "./marks.mjs";

/** The slot a scalable quantity leaves in a step's HTML, filled at request time (fillQuantities). */
export const SLOT = (/** @type {number} */ i) => `QZQ${i}QZQ`;
export const SLOT_PATTERN = /QZQ(\d+)QZQ/g;

/** @typedef {import("./render.mjs").ProcedureRecord} ProcedureRecord */

/**
 * The scale factor a request asks for, or 1. A protocol scales its material totals by the count of its
 * unit; a recipe scales its step amounts by servings.
 *
 * @param {ProcedureRecord} record
 * @param {number | null} asked the count (protocol) or servings (recipe) in the URL
 */
export function scaleFactor(record, asked) {
  if (!asked || !(asked > 0) || asked > 1000) return 1;
  if (record.profile === "recipe" && record.servings) return asked / record.servings;
  if (record.profile === "protocol" && record.scale) return asked / record.scale.count;
  return 1;
}

/**
 * The step's HTML with its quantity slots filled. A protocol's step amounts are per unit and never
 * scale; a recipe's scale unless the file fixed them.
 *
 * @param {{ html: string | null, quantities: Array<{ name?: string, amount: string, unit: string, fixed: boolean, min: number | null, max: number | null }> }} step
 * @param {number} factor
 * @param {(q: { name?: string, amount: string, unit: string, fixed: boolean, min: number | null, max: number | null }) => string} [show] how a recipe shows an amount in the reader's units (recipe-views.mjs)
 */
export function fillQuantities(step, factor, show) {
  return (step.html ?? "").replace(SLOT_PATTERN, (_all, i) => {
    const q = step.quantities[Number(i)];
    if (!q) return "";
    return show ? show(q) : formatQuantity({ ...q, raw: "" }, factor);
  });
}
