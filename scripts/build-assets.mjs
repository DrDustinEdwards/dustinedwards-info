// A Worker cannot list its own static assets, so they are enumerated into a committed manifest.

import { createHash } from "node:crypto";
import { readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { classify, excludedFromAssets, isRaster, roleOf } from "../app/lib/media/classify.mjs";
import { WEBP_QUALITY } from "../app/lib/media/encoding.mjs";
import { ASSET_MANIFEST_PATH as ASSET_MANIFEST_REPO_PATH } from "../app/lib/media/manifest.mjs";
import { isMain } from "./lib/is-main.mjs";

// Anchored to the repo, not the working directory: a run from elsewhere walked nothing or the wrong tree.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
// The repo path is POSIX because the Worker hands it to an API verbatim.
export const ASSET_MANIFEST_PATH = path.join(ROOT, ...ASSET_MANIFEST_REPO_PATH.split("/"));

/**
 * The exclusion is applied inside the walk because the gate imports this and diffs it against D1.
 *
 * @param {string} [dir]
 * @returns {Promise<string[]>}
 */
export async function walkPublic(dir = PUBLIC_DIR) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkPublic(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    // Forward slashes: that is what the browser asks for and what `env.ASSETS.fetch()` matches on.
    const sitePath = `/${path.relative(PUBLIC_DIR, full).split(path.sep).join("/")}`;
    // Named non-assets only: anything else unrecognised meets the classifier, which throws.
    if (excludedFromAssets(sitePath)) continue;
    out.push(sitePath);
  }
  return out.sort();
}

/** @param {string[]} paths */
export function placeholderPaths(paths) {
  return paths.filter((p) => isRaster(p) && roleOf(p) === "content");
}

/** Matched to the media rebuild's own placeholder width. */
const PLACEHOLDER_WIDTH = 20;

/**
 * The digest is what catches a file edited in place. It does not re-encode to compare: two machines
 * running the same pinned encoder can differ by a byte.
 *
 * @param {string} sitePath
 * @returns {Promise<{ sha: string, lqip: string }>}
 */
async function placeholderFor(sitePath) {
  const bytes = await readFile(path.join(PUBLIC_DIR, sitePath.slice(1)));
  const lqip = await sharp(bytes)
    .resize({ width: PLACEHOLDER_WIDTH })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return {
    sha: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
    lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
  };
}

async function main() {
  const paths = await walkPublic();
  if (paths.length === 0) {
    throw new Error(`walked public/ and found no files, which cannot be right`);
  }

  // Classify every path here rather than at rebuild time, so an unclassified extension stops THIS
  // build instead of failing inside a Worker where the symptom is a missing row.
  for (const p of paths) classify(p);

  /** @type {Record<string, { sha: string, lqip: string }>} */
  const placeholders = {};
  const wanted = placeholderPaths(paths);
  if (wanted.length === 0) {
    throw new Error(
      `walked public/ and found no content raster images, so no post can ` +
        `carry a placeholder. That is a broken classifier, not an empty directory.`,
    );
  }
  // JSON.stringify writes keys in insertion order and `walkPublic` sorts, so the artifact is stable.
  for (const p of wanted) placeholders[p] = await placeholderFor(p);

  const manifest = { generated: paths.length, paths, placeholders };
  const body = `${JSON.stringify(manifest, null, 2)}\n`;

  // Written only when it differs, so a no-op build leaves the mtime alone.
  let previous = "";
  try {
    previous = await readFile(ASSET_MANIFEST_PATH, "utf8");
  } catch (error) {
    // Absent is a first build; any other read failure is reported rather than overwritten.
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
  if (previous !== body) await writeFile(ASSET_MANIFEST_PATH, body, "utf8");

  console.log(
    `build:assets ${paths.length} file(s) under public/, ` +
      `${wanted.length} placeholder(s) derived` +
      `${previous === body ? " (unchanged)" : ""}`,
  );
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:assets failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
