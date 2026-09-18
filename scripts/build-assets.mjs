/**
 * Enumerates `public/` into a committed manifest, because a Worker cannot list its own static
 * assets.
 *
 *   npm run build:assets
 *
 * BOUNDARY: it carries the paths and ONE derived value, the body placeholder the rendered HTML
 * bakes in. Bytes, mime and dimensions are the rebuild's, and the placeholder D1 holds for the
 * same file is a different derivation for a different consumer.
 */

import { createHash } from "node:crypto";
import { readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { classify, excludedFromAssets, isRaster, roleOf } from "../app/lib/media/classify.mjs";
import { WEBP_QUALITY } from "../app/lib/media/encoding.mjs";
import { ASSET_MANIFEST_PATH as ASSET_MANIFEST_REPO_PATH } from "../app/lib/media/manifest.mjs";

export const PUBLIC_DIR = "public";
/**
 * The same file the manifest module names, spelled for this platform's filesystem. DERIVED in
 * this direction only: the repo path is POSIX because the Worker hands it to an API verbatim.
 */
export const ASSET_MANIFEST_PATH = path.join(...ASSET_MANIFEST_REPO_PATH.split("/"));

/**
 * Every file under `public/`, site-absolute and sorted, so the artifact is stable: a generated
 * artifact that churns cannot be byte-compared. The exclusion is applied HERE, inside the walk,
 * because the gate imports this function and diffs what it returns against D1. One set, both
 * readers.
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
    // Site-absolute, forward slashes, because that is what the browser asks for
    // and what `env.ASSETS.fetch()` matches on. Backslashes on Windows would
    // make the artifact platform-dependent.
    const sitePath = `/${path.relative(PUBLIC_DIR, full).split(path.sep).join("/")}`;
    // Named non-assets only: anything else unrecognised meets the classifier, which throws. Skipping
    // is a decision someone made by name, never a fallthrough.
    if (excludedFromAssets(sitePath)) continue;
    out.push(sitePath);
  }
  return out.sort();
}

/**
 * The paths that get a body placeholder: raster images a post can put in prose. The role is the
 * classifier's answer rather than a second rule here. DERIVED, never hand-listed, so a content
 * image gets one by existing, and the gate asserts this set both directions.
 *
 * @param {string[]} paths
 */
export function placeholderPaths(paths) {
  return paths.filter((p) => isRaster(p) && roleOf(p) === "content");
}

/** The LQIP width, in pixels. Matched to the media rebuild's own placeholder. */
const PLACEHOLDER_WIDTH = 20;

/**
 * One placeholder, plus the digest of the bytes it was derived FROM. The digest is what makes the
 * entry checkable: membership cannot see a file EDITED IN PLACE, which is the one way a static
 * asset changes. IT DOES NOT RE-ENCODE TO COMPARE: two machines running the same pinned encoder
 * can differ by a byte, and a gate that fails on one platform gets turned off.
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
    throw new Error(`walked ${PUBLIC_DIR}/ and found no files, which cannot be right`);
  }

  // Classify every path here rather than at rebuild time, so an unclassified extension stops THIS
  // build instead of failing inside a Worker where the symptom is a missing row.
  for (const p of paths) classify(p);

  /** @type {Record<string, { sha: string, lqip: string }>} */
  const placeholders = {};
  const wanted = placeholderPaths(paths);
  if (wanted.length === 0) {
    throw new Error(
      `walked ${PUBLIC_DIR}/ and found no content raster images, so no post can ` +
        `carry a placeholder. That is a broken classifier, not an empty directory.`,
    );
  }
  // Sorted by construction: `walkPublic` sorts and this preserves that order, so
  // the artifact is stable and byte-comparable. JSON.stringify writes keys in
  // insertion order.
  for (const p of wanted) placeholders[p] = await placeholderFor(p);

  const manifest = { generated: paths.length, paths, placeholders };
  const body = `${JSON.stringify(manifest, null, 2)}\n`;

  // Written only when it differs, so a no-op build leaves the mtime alone.
  let previous = "";
  try {
    previous = await readFile(ASSET_MANIFEST_PATH, "utf8");
  } catch {
    /* first run */
  }
  if (previous !== body) await writeFile(ASSET_MANIFEST_PATH, body, "utf8");

  console.log(
    `build:assets ${paths.length} file(s) under ${PUBLIC_DIR}/, ` +
      `${wanted.length} placeholder(s) derived` +
      `${previous === body ? " (unchanged)" : ""}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:assets failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
