/**
 * THE SERVER-SIDE GATE ON IRREVERSIBLE ACTIONS.
 *
 * Every destructive intent in this app answers to one predicate, and it lives
 * here rather than in any one feature's module because it is not a media rule
 * or a posts rule.
 *
 * ## The class this exists to close
 *
 * An external audit found three destructive paths whose ONLY confirmation ran
 * in a client event handler: bulk post delete (`prompt()` in `onClick`), single
 * post delete and single media delete (both `confirm()` in `onSubmit`). With
 * scripting off the handler never runs, the form posts, and the action deletes.
 * The ceremony was script-only while the destruction was not.
 *
 * The same defect had already been found and fixed once, on `empty-trash`, and
 * closed WITHOUT sweeping for siblings. That is why three survived. The rule
 * that follows from it:
 *
 * **A GUARD THAT RUNS IN A HANDLER IS NOT A GUARD. It is feedback. The gate is
 * whatever the ACTION checks, because the action is the only thing an attacker,
 * a crawler, a prefetch or a reader without JavaScript cannot skip.**
 *
 * ## The shape
 *
 * An unconfirmed destructive POST is NOT an error. It is the confirmation step:
 * the action refuses, returns what it would have destroyed, and the route
 * renders a server-rendered confirmation carrying the same fields back. That
 * gives the no-script path a real second step instead of a dead end, and it
 * needs no new URL vocabulary and no client state.
 */

/**
 * THE TYPED-COUNT LADDER, as a predicate rather than a line inside an action.
 *
 * It was three lines in the route, which meant NO gate could reach it: the
 * admin-ui harness renders and compares submissions, it never runs an action.
 * A plant that deleted the check left every gate green, so the one guard
 * standing between a mistyped confirmation and an irreversible delete was
 * unasserted. A pure function is the only part of an action a test can hold.
 *
 * STRICT AND STRING-EQUAL, deliberately. Not `Number(typed) === count`, because
 * that accepts "3 ", "03", "+3", "3.0" and `""` for zero. The ceremony is worth
 * having only if typing something ADJACENT to the count does not pass it.
 *
 * @param {unknown} typed What the operator typed into the confirmation.
 * @param {number} count The count read in THIS request, not one the form carried.
 * @returns {boolean} Whether the destructive branch may proceed.
 */
export function confirmationSatisfied(typed, count) {
  if (!Number.isInteger(count) || count <= 0) return false;
  return String(typed ?? "").trim() === String(count);
}

/**
 * The form field every destructive confirmation travels in.
 *
 * ONE NAME, stated once. Three routes now read it, and a second spelling would
 * be a guard that silently never matches: the action would refuse forever, an
 * operator would work around it, and the workaround would be the bug.
 */
export const CONFIRM_FIELD = "confirm-count";
