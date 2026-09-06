/**
 * Node adapter for the shared markdown pipeline.
 *
 * The pipeline itself lives in `app/lib/content/pipeline.mjs` so the Worker can
 * import it too. Everything Node-only stays here: reading files from disk and
 * measuring images with the filesystem. The editor supplies its own resolver
 * over HTTP, and both callers therefore render identical HTML from identical
 * bytes.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { imageSize } from "image-size";

import {
  ContentError,
  renderPost as renderPostShared,
} from "../../app/lib/content/pipeline.mjs";
import { dimensionsFromKey } from "../../app/lib/media/classify.mjs";
import { ASSET_MANIFEST_PATH } from "../../app/lib/media/manifest.mjs";

export { ContentError };

/** Where site-absolute image paths resolve from at build time. */
const PUBLIC_DIR = "public";

/**
 * The committed manifest, READ rather than imported, once per process.
 *
 * Read for two reasons. It is what the Worker side does, so the two resolvers
 * differ in the path they read and in nothing else. And an `import ... with {
 * type: "json" }` gives TypeScript a type with nine literal keys, so indexing
 * it by a variable is an error that has to be cast away, which is a cast around
 * the only interesting property of the lookup.
 *
 * Module scope, not per resolver: `build:content` makes one resolver per post
 * and the artifact does not change under a build.
 *
 * @type {Promise<Record<string, { sha: string, lqip: string }>> | null}
 */
let placeholderMemo = null;
function assetPlaceholders() {
  placeholderMemo ??= readFile(ASSET_MANIFEST_PATH, "utf8").then(
    (text) => JSON.parse(text).placeholders ?? {},
  );
  return placeholderMemo;
}

/**
 * Builds a resolver that measures an image on disk. A missing or unreadable
 * file is a build failure, never a silently absent attribute, because the whole
 * point is preventing layout shift.
 *
 * `/media/*` is resolved from the KEY, not from bytes, and that is finding
 * B002. Those blobs live only in R2, so this build cannot read them at all; the
 * Worker could, and did, which meant the first `/media/` citation would commit
 * HTML that `build:content` could not reproduce. The key now carries
 * `-<w>x<h>` and both resolvers parse it with the same `dimensionsFromKey`, so
 * neither reads bytes and there is nothing left to disagree about.
 *
 * THE PLACEHOLDER COMES FROM THE COMMITTED MANIFEST, for the same reason and
 * with the same shape. It cannot be derived here: this side has sharp and the
 * Worker does not, so a value computed at render time would be a value the two
 * writers could never agree on. `build:assets` derives it once, commits it, and
 * both resolvers look it up. `/media/` gets none, which is the exclusion stated
 * in `rehypeImageSources`.
 *
 * Exported so `check:invariants` can compare it against the Worker's resolver
 * directly rather than inferring their agreement from rendered HTML.
 *
 * @param {string} file source markdown path, for the error message
 * @returns {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>}
 */
export function makeResolveImage(file) {
  return async (/** @type {string} */ src) => {
    if (!src.startsWith("/")) {
      throw new ContentError(file, `image src "${src}" must be site-absolute`);
    }

    if (src.startsWith("/media/")) {
      const dimensions = dimensionsFromKey(src);
      if (!dimensions) {
        throw new ContentError(
          file,
          `media image "${src}" carries no dimensions in its key. ` +
            `Uploaded images are keyed <hash>-<width>x<height>.<ext>; re-upload ` +
            `it in the editor to get a key this build can measure.`,
        );
      }
      return dimensions;
    }

    const onDisk = path.join(PUBLIC_DIR, src.slice(1));
    /** @type {Buffer} */
    let bytes;
    try {
      bytes = await readFile(onDisk);
    } catch {
      throw new ContentError(file, `image "${src}" not found at ${onDisk}`);
    }
    const size = imageSize(bytes);
    if (!size.width || !size.height) {
      throw new ContentError(file, `image "${src}" has no readable dimensions`);
    }
    // Absent for anything the manifest does not cover, which is every static
    // asset that is not a content raster. Absent is a real answer: the image
    // renders without a placeholder, exactly as it did before this existed.
    const placeholder = (await assetPlaceholders())[src]?.lqip;
    return { width: size.width, height: size.height, ...(placeholder ? { placeholder } : {}) };
  };
}

/**
 * Renders one markdown file into the row shape the database stores.
 *
 * @param {string} file path relative to the repo root
 * @param {string} raw file contents
 */
export async function renderPost(file, raw) {
  return renderPostShared({
    file,
    raw,
    expectedSlug: path.basename(file, ".md"),
    resolveImage: makeResolveImage(file),
  });
}
