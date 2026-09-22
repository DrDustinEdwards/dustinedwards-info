/**
 * Node adapter for the shared markdown pipeline.
 *
 * BOUNDARY: the pipeline itself lives where the Worker can import it too and everything Node-only
 * stays here, so the two callers differ in how they read a file and in nothing else.
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
 * The committed manifest, READ rather than imported, once per process. Read because it is what
 * the Worker side does, so the two resolvers differ in the path they read and in nothing else, and
 * because an import attribute gives a type whose literal keys make a variable lookup an error that
 * has to be cast away. Module scope, because the build makes one resolver per post.
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
 * Builds a resolver that measures an image on disk. A missing file is a build failure, never a
 * silently absent attribute, the whole point being to prevent layout shift.
 *
 * A media blob is resolved from the KEY, not from bytes: those live only in R2, so this build
 * cannot read them at all while the Worker could, which meant the first such citation would commit
 * HTML the build could not reproduce. The key now carries the dimensions and both resolvers parse
 * it the same way.
 *
 * THE PLACEHOLDER COMES FROM THE COMMITTED MANIFEST, for the same reason: this side has an encoder
 * the Worker does not, so a value computed at render time is one the two writers could never agree
 * on. Exported so the invariants gate can compare it against the Worker's resolver directly.
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
            `Uploaded images are keyed dustin-edwards-[<name>-]<hash>-<width>x<height>.<ext>; re-upload ` +
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
    // Absent for anything the manifest does not cover. Absent is a real answer: the image renders
    // without a placeholder, exactly as it did before this existed.
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
