import { spawnSync } from "node:child_process";

/**
 * `git status --porcelain` in `root`. `ok` is false when git could not be read at all, which every
 * caller refuses on: "could not check" must never deploy. `dirty` is the porcelain listing, empty
 * for a clean tree.
 *
 * @param {string} root
 * @returns {{ ok: boolean, dirty: string, error: string }}
 */
export function dirtyTree(root) {
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  return {
    ok: status.status === 0,
    dirty: (status.stdout ?? "").trim(),
    error: (status.stderr ?? "").trim(),
  };
}
