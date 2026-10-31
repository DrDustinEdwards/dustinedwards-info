// The D1 Time Travel bookmark ship takes before anything writes (area 8, R4), read the way devkit's worker-deploy.yml
// reads it: `wrangler d1 time-travel info <db> --json`, run from a directory outside the checkout so wrangler looks the
// database up by name through the API rather than through this repository's config.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The bookmark in wrangler's output, or null. Its JSON may follow a banner line, so it is read from the first brace.
 * @param {string} text
 * @returns {string | null}
 */
export function parseBookmark(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  try {
    const bookmark = JSON.parse(text.slice(start)).bookmark;
    return typeof bookmark === "string" && bookmark !== "" ? bookmark : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} root the checkout, whose installed wrangler runs
 * @param {string} database the D1 database's name
 * @returns {{ bookmark: string | null, at: string, output: string }}
 */
export function readBookmark(root, database) {
  const at = new Date().toISOString();
  const outside = mkdtempSync(join(tmpdir(), "ship-bookmark-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "d1", "time-travel", "info", database, "--json"],
      { cwd: outside, encoding: "utf8", timeout: 90_000 },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;
    return { bookmark: result.status === 0 ? parseBookmark(String(result.stdout ?? "")) : null, at, output };
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
}
