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
 * and reconciled by a gate. Bytes, mime and dimensions are derived by the
 * rebuild from the actual file, so putting them here would create a second copy
 * to go stale for no gain.
 *
 * `check:content` compares this against the filesystem, so a stale manifest is
 * named as a stale manifest rather than surfacing later as a confusing D1 diff.
 *
 * ## IT CARRIES ONE DERIVED VALUE, THE BODY PLACEHOLDER, AND WHY
 *
 * It carried paths only until 2026-09-06. The exception is the LQIP the markdown
 * pipeline writes onto a static content image, and it is here because of finding
 * B002: the rendered HTML is a GATED ARTIFACT, so whatever the Worker bakes into
 * it the Node build has to bake in too, from a clone, with no bindings and no
 * network. A placeholder is neither derivable from the src (the way `srcset` is)
 * nor readable from the same store by both writers (the Worker cannot run this
 * encoder and Node cannot call the Images binding). A committed artifact both
 * resolvers read is the only shape that satisfies both, and it is the same
 * answer the dimensions arrived at when they moved into the key.
 *
 * **The placeholder D1 holds for the same file is NOT this one, and that is not
 * a duplicate fact.** The media rebuild derives its own through the Images
 * binding, for the admin library, under rule 18: the index is a projection of
 * what exists. This one is an input to a gated build artifact. Two consumers,
 * two derivation paths, and neither can serve the other: the rebuild runs in a
 * Worker with no sharp, and the build runs in Node with no binding.
 *
 * `/media/` KEYS ARE EXCLUDED, here and in `rehypeImageSources`. An uploaded
 * object is not in the repository, so no build could derive one; the exclusion
 * is written where a reader of the plugin will meet it.
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
 * The same file `manifest.mjs` names, spelled for this platform's filesystem.
 *
 * DERIVED, in this direction only. The repo path is POSIX because the Worker
 * hands it to the GitHub contents API verbatim; a Windows `path.join` result
 * would 404 there in a way that reads like a missing artifact. Splitting a
 * POSIX path and rejoining it is correct on both platforms, so the one stated
 * constant is the one that cannot be derived from the other.
 */
export const ASSET_MANIFEST_PATH = path.join(...ASSET_MANIFEST_REPO_PATH.split("/"));

/**
 * Every file under `public/`, as site-absolute paths, sorted.
 *
 * Sorted so the artifact is stable: an unordered directory read would rewrite
 * the file on a machine whose filesystem enumerates differently, and a generated
 * artifact that churns cannot be byte-compared by anything.
 *
 * Minus the named non-assets in `classify.mjs`. The exclusion is applied HERE,
 * inside the walk, rather than in main(): `check:media` imports this function and
 * diffs what it returns against D1, so an exclusion applied only to the manifest
 * would make the gate demand a row for a file the manifest deliberately omits.
 * One set, both readers.
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
    // Named non-assets only. Anything else unrecognised stays in the list and
    // meets classify(), which throws. Skipping is a decision someone made by
    // name, never a fallthrough.
    if (excludedFromAssets(sitePath)) continue;
    out.push(sitePath);
  }
  return out.sort();
}

/**
 * The paths that get a body placeholder: raster images a post can put in prose.
 *
 * `role === "content"` is the narrowing, and it is `classify.mjs`'s answer
 * rather than a second rule written here. An icon is fetched by the browser
 * from a `<link>`, a brand asset by application code, a diagram by the directive
 * that owns its light and dark pair; none of the three reaches
 * `rehypeImageSources`, and deriving placeholders for them would be twenty
 * kilobytes of manifest nothing reads.
 *
 * DERIVED, never hand-listed, so a content image added to `public/` gets one by
 * existing. `check:content` asserts this set against the manifest in both
 * directions, which is what makes "somebody forgot to re-run the build" a red
 * gate rather than an image that quietly renders without a placeholder.
 *
 * @param {string[]} paths
 */
export function placeholderPaths(paths) {
  return paths.filter((p) => isRaster(p) && roleOf(p) === "content");
}

/** The LQIP width, in pixels. Matched to the media rebuild's own placeholder. */
const PLACEHOLDER_WIDTH = 20;

/**
 * One placeholder, plus the digest of the bytes it was derived FROM.
 *
 * The digest is what makes the entry checkable. Membership alone catches a file
 * added or deleted and cannot see a file EDITED IN PLACE, which is the one way
 * a static asset changes: `public/` paths are not content addressed, so the same
 * path can hold different bytes tomorrow. `check:content` re-hashes the file
 * and compares, which is cheap, deterministic and platform independent.
 *
 * IT DOES NOT RE-ENCODE TO COMPARE, deliberately. Two machines running the same
 * pinned sharp can differ by a byte in an encoder, and a gate that fails on
 * Linux and passes on Windows gets turned off. The source digest answers "is
 * this entry stale" without asserting anything about the encoder that produced
 * it; that the stored value IS a lossy WebP data URI is asserted separately,
 * through the same function `check:image-weight` uses on the D1 column.
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

  // Classify every path here rather than at rebuild time, so an unclassified
  // extension stops THIS build with a clear message instead of failing inside a
  // Worker where the only symptom would be a missing row.
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
