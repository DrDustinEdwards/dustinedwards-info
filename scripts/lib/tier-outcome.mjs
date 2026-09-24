/** NTSTATUS codes that reach a parent as an exit code on Windows: a crash, never a gate verdict. */
const WINDOWS_CRASH_CODES = new Map([
  [3221225794, "STATUS_DLL_INIT_FAILED"],
  [3221225495, "STATUS_NO_MEMORY"],
  [3221225477, "STATUS_ACCESS_VIOLATION"],
  [3221226356, "STATUS_HEAP_CORRUPTION"],
]);

/** Its absence is the evidence that no gate result exists. */
const SUMMARY = /^\s*(\d+) passed, (\d+) failed/m;

const FAILING_ROW = /^\s+FAIL\s+(\S+)/gm;

/**
 * A crashed tier is not a red gate: no result exists, so no gate can be named. A zero exit with no
 * summary is `crashed`, because a runner killed between its last gate and its table can exit zero.
 *
 * @param {{ code: number | null, signal?: string | null, text?: string }} result
 * @returns {{ state: "passed" | "red" | "crashed", failing: string[], why: string, remedy: string }}
 */
export function tierOutcome({ code, signal = null, text = "" }) {
  const summary = SUMMARY.exec(text ?? "");
  const failing = [...(text ?? "").matchAll(FAILING_ROW)].map((m) => m[1]);
  const ntstatus = code === null ? undefined : WINDOWS_CRASH_CODES.get(code);

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
