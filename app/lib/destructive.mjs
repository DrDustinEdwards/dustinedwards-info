/*
 * A confirmation in a client handler is feedback, not a guard: with script off
 * the form posts anyway. The gate is whatever the ACTION checks.
 */

/**
 * String-equal on purpose: `Number(typed) === count` would accept "03", "+3",
 * "3.0" and "" for zero.
 *
 * @param {unknown} typed What the operator typed into the confirmation.
 * @param {number} count The count read in THIS request, not one the form carried.
 * @returns {boolean} Whether the destructive branch may proceed.
 */
export function confirmationSatisfied(typed, count) {
  if (!Number.isInteger(count) || count <= 0) return false;
  return String(typed ?? "").trim() === String(count);
}

export const CONFIRM_FIELD = "confirm-count";
