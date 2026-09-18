/**
 * Resolving the bash binary a gate needs, ONCE, from any shell, because a bare name is on PATH
 * under git bash and absent under the PowerShell that runs ship.
 *
 * BOUNDARY: every candidate is PROVEN BY RUNNING IT rather than by existing on disk, and it FAILS
 * CLOSED, returning null so the caller prints one line instead of a spawn error per case.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

/**
 * The default Git for Windows install location, spelled with forward slashes: Windows resolves
 * either, and a forward-slash literal cannot be damaged by a scripted edit the way a backslash can.
 */
const GIT_FOR_WINDOWS_DEFAULT = "C:/Program Files/Git/bin/bash.exe";

/** How far above `git --exec-path` an install root is looked for. */
const ANCESTOR_LIMIT = 4;

/** @type {{ path: string, source: string } | null | undefined} */
let resolved;

/**
 * Where `git --exec-path` says git lives, or null if git cannot be asked.
 *
 * @returns {string | null}
 */
function gitExecPath() {
  // No `shell: true`: `git` is a real executable rather than a `.cmd` shim, so it spawns directly
  // on Windows, which is how every other gate here already calls it.
  const asked = spawnSync("git", ["--exec-path"], { encoding: "utf8", windowsHide: true });
  if (asked.error || asked.status !== 0) return null;
  const path = String(asked.stdout ?? "").trim();
  return path.length > 0 ? path : null;
}

/**
 * Every place a bash might be, in the order they are tried. Deduplicated on the path, so a
 * machine where the walk and the literal default agree does not probe the same binary twice.
 *
 * @returns {{ path: string, source: string }[]}
 */
export function bashCandidates() {
  /** @type {{ path: string, source: string }[]} */
  const candidates = [{ path: "bash", source: "PATH" }];

  const execPath = gitExecPath();
  if (execPath) {
    let ancestor = execPath;
    for (let level = 0; level < ANCESTOR_LIMIT; level += 1) {
      const next = dirname(ancestor);
      // dirname of a root returns the root, so the walk stops rather than spinning at the top of the drive.
      if (next === ancestor) break;
      ancestor = next;
      for (const relative of [join("bin", "bash.exe"), join("usr", "bin", "bash.exe")]) {
        candidates.push({
          path: join(ancestor, relative),
          source: `git --exec-path + ${relative.replace(/\\/g, "/")}`,
        });
      }
    }
  }

  candidates.push({ path: GIT_FOR_WINDOWS_DEFAULT, source: "Git for Windows default install" });

  /** @type {Set<string>} */
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.path.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Whether this candidate can actually run a program.
 *
 * @param {string} path
 * @returns {boolean}
 */
function runs(path) {
  const probe = spawnSync(path, ["-c", "echo ok"], { encoding: "utf8", windowsHide: true });
  if (probe.error || probe.status !== 0) return false;
  return String(probe.stdout ?? "").trim() === "ok";
}

/**
 * The first candidate that runs, or null if none does. Memoised INCLUDING THE NULL: a gate that
 * drives a hook once per case must not pay a process-spawning search per case, and a machine with
 * no bash must not be searched repeatedly to be told the same thing.
 *
 * @returns {{ path: string, source: string } | null}
 */
export function resolveBash() {
  if (resolved !== undefined) return resolved;
  for (const candidate of bashCandidates()) {
    if (runs(candidate.path)) {
      resolved = candidate;
      return resolved;
    }
  }
  resolved = null;
  return resolved;
}

/**
 * The ONE line a caller prints when nothing ran, and the candidates under it: "bash could not be
 * found" with no places named is unactionable, the reader being unable to tell a machine with no
 * git from one whose Git install is somewhere this does not look.
 *
 * @returns {string}
 */
export function bashNotFoundMessage() {
  const tried = bashCandidates()
    .map((candidate) => `          ${candidate.path}  (${candidate.source})`)
    .join("\n");
  return (
    "bash could not be found, so this gate cannot run the hook it checks.\n" +
    "        Install Git for Windows or put a bash on PATH. Tried:\n" +
    tried
  );
}
