// The content's source lives in D1 (source_files, drizzle/0032), and the files under these paths in the repository
// are its seed: scripts/seed-sources.mjs copies a file into D1 only when D1 has never held its path, and
// scripts/pull-sources.mjs writes D1's files over the checkout before a deploy builds from it. The pull records what
// it wrote in PULL_MANIFEST, so the clean-tree checks accept exactly those files and the dates come from D1.

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Every path a save writes: the kinds' directories and llms.txt. */
export const SOURCE_PATHS = [
  "content/posts",
  "content/pages",
  "content/cv",
  "content/dictionary",
  "content/phages",
  "content/procedures",
  "content/publications",
  "content/registry",
  "content/roster",
  "content/llms.txt",
];

/** @param {string} file a repository path */
export const isSourcePath = (file) => SOURCE_PATHS.some((p) => file === p || file.startsWith(`${p}/`));

/** Gitignored: written by the pull, removed when ship restores the checkout. */
export const PULL_MANIFEST = ".content-pull.json";

/** The git blob sha of a file's bytes, the version D1 stores. @param {Buffer | string} bytes */
export function blobSha(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

/**
 * What the last pull wrote, by repository path: the blob sha (null for a file D1 does not hold, which the pull
 * removed) and the day D1 last changed it. Null when no pull ran in this checkout.
 *
 * @param {string} [root]
 * @returns {Record<string, { sha: string | null, day: string | null }> | null}
 */
export function readPullManifest(root = ROOT) {
  const file = path.join(root, PULL_MANIFEST);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")).files;
}

/**
 * Whether the checkout's copy of a path is exactly what the pull wrote there.
 *
 * @param {string} root @param {string} file @param {{ sha: string | null }} entry
 */
export function matchesPull(root, file, entry) {
  const at = path.join(root, file);
  if (entry.sha === null) return !existsSync(at);
  return existsSync(at) && blobSha(readFileSync(at)) === entry.sha;
}

/**
 * The rows of a `wrangler d1 execute --json` answer.
 *
 * @param {{ status: number, stdout: string, output: string }} read
 * @param {string} what
 */
export function jsonRows(read, what) {
  if (read.status !== 0) throw new Error(`${what} failed:\n${read.output}`);
  const match = read.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`${what} printed no JSON:\n${read.output}`);
  return JSON.parse(match[0])[0].results;
}
