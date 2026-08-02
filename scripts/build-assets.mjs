/**
 * Enumerates `public/` into a committed manifest.
 *
 *   npm run build:assets
 *
 * **This exists because a Worker cannot list its own static assets.** The assets
 * binding has exactly one method, `fetch()`, so `env.ASSETS` can serve any path
 * it is given and can discover none of them. The media rebuild runs in the
 * Worker (every binding it needs is real there: MEDIA, IMAGES, ASSETS, DB), so
 * the one thing it cannot do for itself is find out which static files exist.
 * This hands it that list.
 *
 * Same shape as `content/generated/posts.json`: a generated artifact, committed,
 * and reconciled by a gate. It carries PATHS ONLY. Bytes, mime, dimensions and
 * the LQIP are all derived by the rebuild from the actual file, so putting them
 * here would create a second copy to go stale for no gain.
 *
 * `check:media` compares this against the filesystem, so a stale manifest is
 * named as a stale manifest rather than surfacing later as a confusing D1 diff.
 */

import { readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { classify } from "../app/lib/media/classify.mjs";

export const PUBLIC_DIR = "public";
export const ASSET_MANIFEST_PATH = path.join("content", "generated", "assets.json");

/**
 * Every file under `public/`, as site-absolute paths, sorted.
 *
 * Sorted so the artifact is stable: an unordered directory read would rewrite
 * the file on a machine whose filesystem enumerates differently, and a generated
 * artifact that churns cannot be byte-compared by anything.
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
    out.push(`/${path.relative(PUBLIC_DIR, full).split(path.sep).join("/")}`);
  }
  return out.sort();
}

async function main() {
  const paths = await walkPublic();
  if (paths.length === 0) {
    throw new Error(`walked ${PUBLIC_DIR}/ and found no files, which cannot be right`);
  }

  // Classify every path here rather than at rebuild time, so an unclassified
  // extension stops THIS build with a clear message instead of failing inside a
  // Worker where the only symptom would be a missing row.
  for (const p of paths) classify(p);

  const manifest = { generated: paths.length, paths };
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
    `build:assets ${paths.length} file(s) under ${PUBLIC_DIR}/` +
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
