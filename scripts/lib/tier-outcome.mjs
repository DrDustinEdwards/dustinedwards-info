/**
 * Reading a gate tier's outcome, and telling a RED gate from a CRASHED tier.
 *
 * BOUNDARY: the decision is pure and runs nothing, so both refusal paths can be driven by tests
 * rather than by killing a real tier to watch what ship says. It reads an exit code, a signal and
 * the tier's own output; it never reads the gates.
 *
 * WHY THIS EXISTS: on 2026-09-21 at ffd85ee, ship refused with "a gate is red, read the table
 * above" and printed no table and no gate name, because the tier had been killed under memory
 * pressure and `run()` collapsed a null status to 1. Both outcomes refuse, which was right. The
 * message named a gate result that did not exist, which cost a full rebuild to disbelieve.
 *
 * @see scripts/ship.mjs
 * @see test/tier-outcome.test.mjs
 */

/**
 * NTSTATUS codes that reach a parent as an exit code on Windows. A crash, never a gate verdict:
 * no gate chooses these and the tier cannot have reported.
 */
const WINDOWS_CRASH_CODES = new Map([
  [3221225794, "STATUS_DLL_INIT_FAILED"],
  [3221225495, "STATUS_NO_MEMORY"],
  [3221225477, "STATUS_ACCESS_VIOLATION"],
  [3221226356, "STATUS_HEAP_CORRUPTION"],
]);

/** The tier's own summary line. Its ABSENCE is the evidence that no gate result exists. */
const SUMMARY = /^\s*(\d+) passed, (\d+) failed/m;

/** Each row the tier prints for a gate that ran and failed. */
const FAILING_ROW = /^\s+FAIL\s+(\S+)/gm;

/**
 * Did the tier report, and what did it say?
 *
 * THREE OUTCOMES, and the third is the one this module was written for:
 *
 *   - **passed**: it reported, and reported nothing failing.
 *   - **red**: it reported, and named gates. Ship names them too.
 *   - **crashed**: it did not report. A signal, an NTSTATUS exit, or no summary line at all.
 *     No gate result exists, so no gate can be named, and saying one is red would be a lie
 *     about a measurement nobody took.
 *
 * FAIL CLOSED IN EVERY DIRECTION. A zero exit with no summary is `crashed`, not `passed`: a tier
 * that did not say it passed has not passed, and a runner killed between its last gate and its
 * table can exit zero.
 *
 * @param {{ code: number | null, signal?: string | null, text?: string }} result
 * @returns {{ state: "passed" | "red" | "crashed", failing: string[], why: string, remedy: string }}
 */
export function tierOutcome({ code, signal = null, text = "" }) {
  const summary = SUMMARY.exec(text ?? "");
  const failing = [...(text ?? "").matchAll(FAILING_ROW)].map((m) => m[1]);
  const ntstatus = code === null ? undefined : WINDOWS_CRASH_CODES.get(code);

  /** What the caller saw, worded once and reused by both crash paths. */
  const seen =
    `exit code ${code === null ? "none" : code}` +
    `${ntstatus ? ` (${ntstatus})` : ""}` +
    `, signal ${signal ?? "none"}`;

  if (signal || ntstatus) {
    return {
      state: "crashed",
      failing: [],
      why: `the gate tier crashed, no gate result exists (${seen})`,
      remedy:
        "A killed tier and a red gate are different facts and this is the killed one: no gate " +
        "reported, so none can be named. On this host the parallel tier dies under memory " +
        "pressure. Run the gates singly, or push and let CI run the tier on a clean checkout. " +
        "Nothing was deployed.",
    };
  }

  if (!summary) {
    return {
      state: "crashed",
      failing: [],
      why: `the gate tier produced no result table, so no gate result exists (${seen})`,
      remedy:
        "The tier prints one summary line when it finishes and printed none, so it did not " +
        "reach the end. Nothing here says a gate is red. Re-run the tier, or push and let CI " +
        "run it on a clean checkout. Nothing was deployed.",
    };
  }

  if (code === 0 && failing.length === 0) {
    return { state: "passed", failing: [], why: summary[0].trim(), remedy: "" };
  }

  return {
    state: "red",
    failing,
    why:
      `a gate is red: ${failing.length > 0 ? failing.join(", ") : `${summary[2]} failed`}` +
      ` (${summary[0].trim()})`,
    remedy:
      "The tier reported, so this is a gate verdict rather than a crash. Fix the gate(s) named " +
      "above and re-run. Nothing was deployed.",
  };
}
