/**
 * Resolving the Python a gate needs, the SAME WAY THE HOOKS DO.
 *
 * ## WHY THIS IS NOT A HARDCODED `python3`
 *
 * MEASURED 2026-09-05 on this machine, both shells:
 *
 *     git bash      python3 -> hookprobe   python -> hookprobe   py -> hookprobe
 *     PowerShell    python3 -> ABSENT      python -> hookprobe   py -> hookprobe
 *
 * A gate spawning `python3` by name would therefore be green in every Claude
 * Code session, which runs git bash, and absent at `npm run ship`, which runs
 * from PowerShell. That is the shape `scripts/lib/bash.mjs` was written for a
 * few hours earlier, recurring in a second interpreter before the ink was dry,
 * which is the whole argument for resolving rather than naming.
 *
 * ## AND WHY THE PROBE IS `print("hookprobe")` RATHER THAN `--version`
 *
 * Copied deliberately from the hooks, which carry the reason: on Windows the
 * bare name `python3` is often the Microsoft Store STUB. The stub satisfies
 * `command -v`, prints a version-ish banner, and is not an interpreter. Only
 * running a program discriminates it, so the candidate must EXECUTE something
 * and be judged on what it printed.
 *
 * Matching the hooks' probe exactly is load-bearing for `check:hook-syntax`: a
 * gate that compiles a hook's embedded Python must use the interpreter that
 * hook would have used, or it is checking a different thing than it claims.
 *
 * ## FAILS CLOSED
 *
 * Returns null when nothing ran. The caller prints one line naming that no
 * Python was found and exits nonzero, exactly as the hooks themselves block
 * rather than passing silently when the probe fails.
 */

import { spawnSync } from "node:child_process";

/**
 * The candidates and their order, IDENTICAL to the hooks' own
 * `for cand in python3 python py`. One owner would be better; a shell script
 * and an ES module cannot share a constant, so the duplication is stated here
 * rather than left for a reader to notice.
 */
const CANDIDATES = ["python3", "python", "py"];

/** What the probe must print, matching the hooks byte for byte. */
const PROBE_OUTPUT = "hookprobe";

/** @type {{ path: string } | null | undefined} */
let resolved;

/**
 * The first candidate that actually runs a program, or null if none does.
 *
 * Memoised, including the null.
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
    // Equality after trimming, never a substring: the Store stub's banner
    // mentions Python and would satisfy a loose match.
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
 * Compile a Python source string, WITHOUT EXECUTING IT.
 *
 * `ast.parse` rather than `exec` or `compile` into a runnable object: the whole
 * subject is whether the string PARSES, and running a hook's checker here would
 * execute repository logic against a gate's stdin for no benefit.
 *
 * ## THE SOURCE CROSSES AS BYTES, WHICH IS THE POINT
 *
 * `sys.stdin.read()` decodes through the platform text layer, and on Windows
 * that is cp1252, so a checker containing a non-ASCII character (these hooks
 * carry U+2014 and U+2013 literals, which is what one of them is FOR) would
 * either mangle or raise for a reason that has nothing to do with its syntax.
 * `sys.stdin.buffer.read().decode("utf-8")` reads the bytes and names the
 * encoding, and the input is handed over as a Buffer for the same reason.
 *
 * Passing the source as an argv argument was the other option and is worse: the
 * strings are multi-line and quote-bearing, and Windows argv quoting is the
 * hazard this repo has already been bitten by.
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
