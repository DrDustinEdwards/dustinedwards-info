import { spawnSync } from "node:child_process";

import { matchesPull, readPullManifest } from "./content-source.mjs";

/**
 * `git status --porcelain` in `root`. `ok` is false when git could not be read at all, which every
 * caller refuses on: "could not check" must never deploy. `dirty` is the porcelain listing, empty
 * for a clean tree. A content file the last pull wrote from D1 (scripts/pull-sources.mjs) is not
 * dirt while it still holds exactly what the pull wrote: it is the source the deploy builds from.
 *
 * @param {string} root
 * @returns {{ ok: boolean, dirty: string, error: string }}
 */
export function dirtyTree(root) {
  const status = spawnSync("git", ["-c", "core.quotePath=false", "status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  const pulled = readPullManifest(root) ?? {};
  const dirty = (status.stdout ?? "")
    .split("\n")
    .filter((line) => {
      if (!line.trim()) return false;
      const file = line.slice(3);
      const entry = pulled[file];
      return !(entry && matchesPull(root, file, entry));
    })
    .join("\n");
  return {
    ok: status.status === 0,
    dirty: dirty.trim(),
    error: (status.stderr ?? "").trim(),
  };
}
