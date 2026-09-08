/**
 * One owner for the floor comparison, and for the line that proves it ran.
 *
 * ## THE DEFECT THIS IS FOR, ruling 23
 *
 * Every counting gate carries a `MINIMUM_*` compared against its own executed
 * count, and prints "only X ran, expected at least N" on breach. NOTHING
 * compares the two when the count is ABOVE the floor. So a floor set once and
 * never re-measured sinks under its count as the gate grows, and the gap is
 * invisible: `check:policy` drifted 46 checks under its floor before anybody
 * looked, which means 46 assertions could have stopped running and the floor
 * would still have passed.
 *
 * A floor that far under its count is a skipped block waiting to happen. The
 * repair is not a tighter floor, which goes stale the same way. It is to make
 * the gap MACHINE-READABLE on every successful run, so `check:floors` can read
 * it back and refuse a gap that has grown.
 *
 * ## WHY THIS RETURNS A STRING INSTEAD OF ASSERTING
 *
 * The obvious shape is a helper that fails the gate itself. It cannot, and the
 * reason is the tenth vacuity class (hard rule 10, VERIFICATION.md).
 *
 * Three reporter shapes coexist across the gates BY DESIGN and must not be
 * tidied into one: `ok(label, condition, detail)`,
 * `assertThat(condition, label, detail)` and `assert(label, ok, detail)`. The
 * names differ precisely so a call copied between two gates is a ReferenceError
 * rather than a silent pass. A shared helper that called one of them would
 * either have to pick a shape, which breaks the gates using the other two, or
 * take a reporter callback, which puts a function in an argument slot next to a
 * label and a count and re-creates the argument-order hazard the rename cured.
 *
 * So this owns the COMPARISON and both MESSAGES, and the call site keeps its own
 * reporter and its own label:
 *
 *     const breach = assertFloor("check:secrets", "checks", checks, MINIMUM_CHECKS);
 *     if (breach) ok("this gate executed its assertions", false, breach);
 *
 * Behaviour on breach is unchanged from the hand-written form it replaces: the
 * same detail text reaches the same reporter and increments the same counter.
 * What is new is the SUCCESS line, which did not exist anywhere before.
 *
 * ## THE SUCCESS LINE IS THE PRODUCT
 *
 * `floor <gate>:<name> executed=<N> minimum=<M>` on one line, printed only when
 * the floor HOLDS. `check:floors` parses it. Two properties it depends on:
 *
 *   The gate name is IN the line rather than inferred from which gate printed
 *   it, because `check:head` runs the offline tier inside a worktree and every
 *   child gate's floor lines surface in ITS stdout. A reader keying on the
 *   producing process would file thirty floors under `check:head`.
 *
 *   It is printed on SUCCESS ONLY. A breach already fails the gate loudly, and
 *   emitting a floor line there would let `check:floors` read a number from a
 *   run that had already refused.
 */

/**
 * The machine-readable success line. One owner, so the gate that writes it and
 * the gate that reads it cannot drift apart in their spelling.
 *
 * Anchored at the start of a line by `check:floors`, so this must never be
 * indented or prefixed at a call site.
 */
/*
 * THE GATE IS THE FIRST TWO SEGMENTS, NOT A GREEDY RUN.
 *
 * This was `/^floor (\S+):(\S+) .../`, and `\S+` is greedy, so a floor NAME
 * containing a colon was split in the wrong place. `check:browser` names its
 * floors `checks:preview` and `checks:deployed` (since 457d049, 2026-09-06),
 * which parsed as gate `check:browser:checks` and name `preview`.
 *
 * The cost was not a wrong number. Section 1 still compared the right count
 * against the right floor, because it only reads what the line says. What broke
 * was section 2, the "every floored gate printed its floor" assertion: the
 * producer set held `check:browser:checks`, so `check:browser` was reported
 * SILENT on every run that reached it, which is the one assertion that exists
 * to notice a floor block that stopped executing.
 *
 * It stayed hidden because `check:browser` is network-tiered: the offline tier
 * `check:floors` runs standalone never reaches it, and neither CI nor ship runs
 * `check:all`. Found 2026-09-08 when `check:all` was run end to end.
 *
 * Anchored to `<word>:<word>` for the gate so a name may carry colons and the
 * split still lands after the gate. Non-greedy alone would not do: it would
 * take `check` as the gate.
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
 *   detail. Hard rule 17: the reasoning belongs to the site that has it, and
 *   flattening thirty bespoke explanations into one generic sentence would
 *   destroy the only part of the message that tells a reader what broke.
 * @returns {string | null} the breach detail for the caller's own reporter, or
 *   null when the floor holds
 */
export function assertFloor(gate, name, executed, minimum, why = "") {
  /*
   * A NaN or a negative reads as a breach rather than as a pass. `executed`
   * arrives from a counter, and a counter that has become undefined is exactly
   * the failure this whole mechanism exists to catch; `NaN < minimum` is false,
   * so the naive comparison would report a clean sweep of nothing.
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
