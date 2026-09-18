/**
 * Resolving the bash binary a gate needs, ONCE, from any shell.
 *
 * Spawning `bash` BY BARE NAME is a dependency on the shell the gate happened to be written in:
 * it is on PATH under git bash and absent under the PowerShell that runs ship, so a gate read as
 * green in every session and refused at a ship step, once per case.
 *
 * THE CANDIDATE ORDER: `bash` on PATH first, so a machine with a deliberate bash keeps using it;
 * then Git for Windows DERIVED from `git --exec-path`, git being a hard dependency already; then
 * the default install path literally. The second is a WALK UP THE ANCESTORS rather than a fixed
 * depth, because the depth is a property of the Git for Windows layout, which is not this repo's
 * to promise, and a fixed two lands inside a directory that ships no bash.
 *
 * EVERY CANDIDATE IS PROVEN BY RUNNING IT. Existence on disk is not the claim: the file in a Git
 * install is a launcher, so each candidate runs a trivial program and must exit 0 and print
 * exactly the expected word, an equality rather than a substring.
 *
 * FAILS CLOSED: it returns null, does not throw, does not fall back, and the caller prints ONE
 * line rather than six copies of a symptom.
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
