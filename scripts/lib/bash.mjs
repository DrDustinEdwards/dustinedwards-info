// A bare `bash` is on PATH under git bash but absent under the PowerShell that runs ship.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

// Forward slashes: Windows resolves either, and a scripted edit can damage a backslash literal.
const GIT_FOR_WINDOWS_DEFAULT = "C:/Program Files/Git/bin/bash.exe";

const ANCESTOR_LIMIT = 4;

/** @type {{ path: string, source: string } | null | undefined} */
let resolved;

/**
 * @returns {string | null}
 */
function gitExecPath() {
  const asked = spawnSync("git", ["--exec-path"], { encoding: "utf8", windowsHide: true });
  if (asked.error || asked.status !== 0) return null;
  const path = String(asked.stdout ?? "").trim();
  return path.length > 0 ? path : null;
}

/**
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
 * @param {string} path
 * @returns {boolean}
 */
function runs(path) {
  const probe = spawnSync(path, ["-c", "echo ok"], { encoding: "utf8", windowsHide: true });
  if (probe.error || probe.status !== 0) return false;
  return String(probe.stdout ?? "").trim() === "ok";
}

/**
 * Memoised including the null: a gate drives a hook once per case and must not respawn the search.
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
