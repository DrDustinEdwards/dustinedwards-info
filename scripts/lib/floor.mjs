/**
 * One owner for the floor comparison, and for the line that proves it ran.
 *
 * BOUNDARY: it owns the COMPARISON and both MESSAGES and asserts nothing itself, returning a
 * string so each call site keeps its own reporter. Making a shared helper assert instead would
 * hide which gate's count fell short.
 */

/**
 * Compare an executed count against its floor.
 *
 * @param {string} gate the npm script name, e.g. "check:secrets"
 * @param {string} name what is being counted, unique within the gate
 * @param {number} executed the count the gate actually reached
 * @param {number} minimum the floor
 * @param {string} [why] this site's own reasoning, appended to the breach
 *   detail. The one-owner rule: flattening thirty bespoke explanations into one
 *   generic sentence would destroy the part that tells a reader what broke.
 * @returns {string | null} the breach detail for the caller's own reporter, or
 *   null when the floor holds
 */
export function assertFloor(gate, name, executed, minimum, why = "") {
  /*
   * A NaN or a negative reads as a breach rather than a pass: a counter that has become undefined
   * is the failure this exists to catch, and `NaN < minimum` is false.
   */
  if (!Number.isFinite(executed) || !Number.isFinite(minimum) || executed < minimum) {
    const reached = Number.isFinite(executed) ? String(executed) : `a non-count (${executed})`;
    return (
      `only ${reached} ran, expected at least ${minimum}. A block was SKIPPED ` +
      `rather than failing.${why ? ` ${why}` : ""}`
    );
  }
  console.log(`floor ${gate}:${name} executed=${executed} minimum=${minimum}`);
  return null;
}
