/**
 * Resolving the bash binary a gate needs, ONCE, from any shell.
 *
 * ## THE DEFECT THIS IS FOR, measured 2026-09-05 rather than reasoned about
 *
 * `check:hook-scope` spawned `bash` BY BARE NAME to drive the real hook file.
 * That is a dependency on the shell the gate happened to be written in. Claude
 * Code runs its Bash tool through git bash, where `bash` is on PATH at
 * `/usr/bin/bash`, so every session read the gate as green. `npm run ship` runs
 * from Dustin's PowerShell, where `bash` is NOT on PATH at all, and step 4
 * refused with `spawnSync bash ENOENT` repeated once per case.
 *
 * Both halves of that are bad. The gate was wrong about its own subject, and it
 * said so six times in a voice that named a spawn failure rather than a missing
 * interpreter.
 *
 * ## THE CANDIDATE ORDER, AND WHY IT IS A WALK AND NOT A DEPTH
 *
 *   1. `bash` on PATH. This is the git bash and WSL-adjacent case, and it stays
 *      first so a machine with a deliberate bash keeps using it.
 *   2. Git for Windows, DERIVED from `git --exec-path`. git is already a hard
 *      dependency of half the gates, so its install root is a fact this repo
 *      can already read rather than a new thing to configure.
 *   3. The default Git for Windows install path, literally.
 *
 * Candidate 2 is a WALK UP THE ANCESTORS, not a fixed number of levels, and the
 * reason is measured on this machine on 2026-09-05:
 *
 *     git --exec-path        C:/Program Files/Git/mingw64/libexec/git-core
 *     two levels up          C:/Program Files/Git/mingw64        bin/bash.exe ABSENT
 *     three levels up        C:/Program Files/Git                bin/bash.exe PRESENT
 *
 * A fixed depth of two lands inside `mingw64`, which ships no bash, so it would
 * have found nothing on the very install it was written for. The depth is a
 * property of the Git for Windows layout, which is not this repo's to promise,
 * so the ancestor that actually holds a bash is SEARCHED FOR instead.
 *
 * ## EVERY CANDIDATE IS PROVEN BY RUNNING IT
 *
 * Existence on disk is not the claim. `bash.exe` in a Git install is a launcher
 * rather than the shell itself; whether it can execute a program is a different
 * question from whether the file is there, and the cost of guessing is a gate
 * that reports a spawn error at its first case rather than a resolution error
 * at step zero. So each candidate runs `-c "echo ok"` and must exit 0 and print
 * exactly `ok`. The needle is an equality after trimming, never a `includes`,
 * because a shim printing an error mentioning "ok" would satisfy a substring.
 *
 * ## FAILS CLOSED, AND THE CALLER SAYS SO ONCE
 *
 * `resolveBash()` returns null when nothing ran. It does not throw, does not
 * fall back to `sh`, and does not let the caller carry on to spawn a bare
 * `bash` anyway. A caller prints ONE line naming that bash could not be found
 * and exits nonzero, which is the difference between an instrument reporting
 * its own precondition and an instrument reporting six copies of a symptom.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

/**
 * The default Git for Windows install location, spelled with forward slashes.
 *
 * Windows resolves either separator, and a forward-slash literal cannot be
 * damaged by a scripted edit or a heredoc the way a backslash literal can.
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
  // No `shell: true`. `git` is a real executable rather than a `.cmd` shim, so
  // it spawns directly on Windows, which is how every other gate in this repo
  // already calls it.
  const asked = spawnSync("git", ["--exec-path"], { encoding: "utf8", windowsHide: true });
  if (asked.error || asked.status !== 0) return null;
  const path = String(asked.stdout ?? "").trim();
  return path.length > 0 ? path : null;
}

/**
 * Every place a bash might be, in the order they are tried.
 *
 * Deduplicated on the path, so a machine where the walk and the literal default
 * agree does not probe the same binary twice and does not report it twice in
 * the failure line.
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
      // dirname of a root returns the root, so the walk stops rather than
      // spinning at the top of the drive.
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
 * The first candidate that runs, or null if none does.
 *
 * Memoised, including the null: a gate that drives a hook once per case must
 * not pay a process-spawning search per case, and a machine with no bash must
 * not be searched repeatedly to be told the same thing.
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
 * The ONE line a caller prints when nothing ran, and the candidates under it.
 *
 * The candidate list is part of the message because "bash could not be found"
 * with no places named is unactionable: the reader cannot tell a machine with
 * no git from one whose Git install is somewhere this does not look.
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
