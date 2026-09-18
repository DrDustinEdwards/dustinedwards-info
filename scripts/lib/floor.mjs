/**
 * One owner for the floor comparison, and for the line that proves it ran.
 *
 * BOUNDARY: it owns the COMPARISON and both MESSAGES and asserts nothing itself, returning a
 * string so each call site keeps its own reporter, and the success line it prints on a HOLDING
 * floor is what `check:floors` reads back. Making a shared helper assert instead would be the
 * tenth vacuity class of hard rule 10.
 */

/**
 * The machine-readable success line. One owner, so writer and reader cannot drift apart, and
 * anchored at the start of a line by `check:floors`, so this is never indented at a call site.
 */
/*
 * THE GATE IS THE FIRST TWO SEGMENTS, NOT A GREEDY RUN. With `\S+` a floor NAME containing a
 * colon split in the wrong place, so `check:browser`'s floors parsed under a gate name of three
 * segments. The count comparison still read the right numbers; what broke was the assertion that
 * every floored gate PRINTED a floor, which reported that gate silent on every run. Non-greedy
 * alone would not do either: it would take the first segment as the gate.
 */
export const FLOOR_LINE = /^floor ([a-z]+:[a-z0-9-]+):(\S+) executed=(\d+) minimum=(\d+)$/;

/**
 * Compare an executed count against its floor.
 *
 * @param {string} gate the npm script name, e.g. "check:secrets"
 * @param {string} name what is being counted, unique within the gate
 * @param {number} executed the count the gate actually reached
 * @param {number} minimum the floor
 * @param {string} [why] this site's own reasoning, appended to the breach
 *   detail. Hard rule 17: flattening thirty bespoke explanations into one
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
