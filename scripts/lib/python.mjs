/**
 * Resolving the Python a gate needs, the SAME WAY THE HOOKS DO, because the bare name resolves
 * under git bash and is absent under the PowerShell that runs ship.
 *
 * BOUNDARY: the probe RUNS A PROGRAM and matches its output exactly, because the bare name on
 * Windows is often a Store stub that satisfies a lookup and is not an interpreter. Matching the
 * hooks' own probe is load-bearing for the gate that compiles what a hook embeds.
 */

import { spawnSync } from "node:child_process";

/**
 * The candidates and their order, IDENTICAL to the hooks' own. One owner would be better; a shell
 * script and an ES module cannot share a constant, so the duplication is stated here rather than
 * left for a reader to notice.
 */
const CANDIDATES = ["python3", "python", "py"];

/** What the probe must print, matching the hooks byte for byte. */
const PROBE_OUTPUT = "hookprobe";

/** @type {{ path: string } | null | undefined} */
let resolved;

/**
 * The first candidate that actually runs a program, or null if none does. Memoised, including
 * the null.
 *
 * @returns {{ path: string } | null}
 */
export function resolvePython() {
  if (resolved !== undefined) return resolved;
  for (const path of CANDIDATES) {
    const probe = spawnSync(path, ["-c", `print("${PROBE_OUTPUT}")`], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (probe.error || probe.status !== 0) continue;
    // Equality after trimming, never a substring: the Store stub's banner mentions Python and would
    // satisfy a loose match.
    if (String(probe.stdout ?? "").trim() !== PROBE_OUTPUT) continue;
    resolved = { path };
    return resolved;
  }
  resolved = null;
  return resolved;
}

/** The one line a caller prints when nothing ran. */
export function pythonNotFoundMessage() {
  return (
    "no working Python found, so embedded checker syntax cannot be compiled.\n" +
    `        Tried, in the hooks' own order: ${CANDIDATES.join(", ")}. On Windows the ` +
    "bare name python3 is often the Microsoft Store stub, which is not an interpreter."
  );
}

/**
 * Compile a Python source string, WITHOUT EXECUTING IT: the subject is whether the string PARSES,
 * and running a hook's checker here would execute repository logic for no benefit.
 *
 * THE SOURCE CROSSES AS BYTES, WHICH IS THE POINT. The platform text layer is not UTF-8 on this
 * host, and these hooks carry non-ASCII literals on purpose, so reading the bytes and naming the
 * encoding is what keeps a syntax question about syntax. Passing the source as an argv argument is
 * worse: the strings are multi-line and quote-bearing, and Windows argv quoting is a hazard this
 * repo has already been bitten by.
 *
 * @param {string} pythonPath
 * @param {string} source
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function compilePython(pythonPath, source) {
  const result = spawnSync(
    pythonPath,
    ["-c", 'import ast,sys; ast.parse(sys.stdin.buffer.read().decode("utf-8"))'],
    { input: Buffer.from(source, "utf8"), encoding: "utf8", windowsHide: true },
  );
  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) {
    const detail = String(result.stderr ?? "").trim() || `exit ${result.status}`;
    return { ok: false, error: detail };
  }
  return { ok: true };
}
