/** NTSTATUS codes that reach a parent as an exit code on Windows: a crash, never a gate verdict. */
export const WINDOWS_CRASH_CODES = new Map([
  [0xc0000142, "STATUS_DLL_INIT_FAILED"],
  [0xc0000017, "STATUS_NO_MEMORY"],
  [0xc0000005, "STATUS_ACCESS_VIOLATION"],
  [0xc0000374, "STATUS_HEAP_CORRUPTION"],
]);

/**
 * Its absence is the evidence that no gate result exists. Global because the LAST one is the
 * tier's: a failed gate's output is printed above the table and can carry its own summary.
 */
const SUMMARY = /^\s*(\d+) passed, (\d+) failed(?:, (\d+) errored)?/gm;

const FAILING_ROW = /^\s+FAIL\s+(\S+)/gm;

/** The rule check-all draws above and below its result table. */
const TABLE_RULE = "-".repeat(52);

/**
 * The FAIL rows of the table above the summary only: a gate's own output uses the same
 * `  FAIL  label` shape and is printed above the table.
 *
 * @param {string} before the text up to the summary line
 * @returns {string[]}
 */
function failingRows(before) {
  const end = before.lastIndexOf(TABLE_RULE);
  const start = end === -1 ? -1 : before.lastIndexOf(TABLE_RULE, end - 1);
  if (start === -1) return [];
  return [...before.slice(start, end).matchAll(FAILING_ROW)].map((m) => m[1]);
}

/**
 * A crashed tier is not a red gate: no result exists, so no gate can be named. A zero exit with no
 * summary is `crashed`, because a runner killed between its last gate and its table can exit zero.
 * Passing needs the counts too: a zero exit over "0 passed" or a nonzero failed count is not a pass.
 *
 * @param {{ code: number | null, signal?: string | null, text?: string }} result
 * @returns {{ state: "passed" | "red" | "crashed", failing: string[], why: string, remedy: string }}
 */
export function tierOutcome({ code, signal = null, text = "" }) {
  const summaries = [...(text ?? "").matchAll(SUMMARY)];
  const summary = summaries.at(-1);
  const failing = summary ? failingRows((text ?? "").slice(0, summary.index)) : [];
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

  const passedCount = Number(summary[1]);
  const failedCount = Number(summary[2]);
  const erroredCount = Number(summary[3] ?? 0);
  const line = summary[0].trim();

  if (passedCount === 0 && failedCount === 0 && erroredCount === 0) {
    return {
      state: "crashed",
      failing: [],
      why: `the gate tier ran no gate (${line}; ${seen})`,
      remedy:
        "A tier that ran nothing asserted nothing, in either direction. The gate list came up " +
        "empty, which is a runner fault rather than a green tier. Nothing was deployed.",
    };
  }

  if (code === 0 && failedCount === 0 && erroredCount === 0 && failing.length === 0) {
    return { state: "passed", failing: [], why: line, remedy: "" };
  }

  if (failedCount === 0 && failing.length === 0 && erroredCount > 0) {
    return {
      state: "crashed",
      failing: [],
      why: `${erroredCount} gate(s) errored and produced no verdict (${line}; ${seen})`,
      remedy:
        "An errored gate wrote nothing and asserted nothing, so it is neither red nor green. " +
        "Re-run those gates alone, or push and let CI run the tier. Nothing was deployed.",
    };
  }

  const named =
    failing.length > 0
      ? failing.join(", ")
      : failedCount > 0
        ? `${failedCount} failed`
        : `exit code ${code === null ? "none" : code}`;
  return {
    state: "red",
    failing,
    why: `a gate is red: ${named} (${line})`,
    remedy:
      "The tier reported, so this is a gate verdict rather than a crash. Fix the gate(s) named " +
      "above and re-run. Nothing was deployed.",
  };
}
