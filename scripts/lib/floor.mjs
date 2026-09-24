/**
 * @param {string} gate
 * @param {string} name
 * @param {number} executed
 * @param {number} minimum
 * @param {string} [why]
 * @returns {string | null} the breach detail, or null when the floor holds
 */
export function assertFloor(gate, name, executed, minimum, why = "") {
  // `NaN < minimum` is false, so a counter gone undefined must be caught explicitly.
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
