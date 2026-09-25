import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { imageSize } from "image-size";

import {
  ContentError,
  renderPost as renderPostShared,
} from "../../app/lib/content/pipeline.mjs";
import { dimensionsFromKey, isRaster, roleOf } from "../../app/lib/media/classify.mjs";
import { ASSET_MANIFEST_PATH } from "../../app/lib/media/manifest.mjs";

export { ContentError };

// Repo-relative for messages; reads go through ROOT so the working directory does not matter.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC_DIR = "public";

/**
 * Read, not imported: an import attribute's literal-key type makes a variable lookup a type error.
 *
 * @type {Promise<Record<string, { sha: string, lqip: string }>> | null}
 */
let placeholderMemo = null;
function assetPlaceholders() {
  placeholderMemo ??= readFile(path.join(ROOT, ASSET_MANIFEST_PATH), "utf8").then((text) => {
    const { placeholders } = JSON.parse(text);
    // A manifest without the map would strip every placeholder from every post without a word.
    if (!placeholders || typeof placeholders !== "object") {
      throw new Error(`${ASSET_MANIFEST_PATH} carries no placeholders map. Run npm run build:assets.`);
    }
    return placeholders;
  });
  return placeholderMemo;
}

/**
 * Media blob bytes live only in R2, so their dimensions come from the key; the placeholder comes
 * from the committed manifest, since only this side has an encoder and the Worker must agree.
 *
 * @param {string} file
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
      bytes = await readFile(path.join(ROOT, onDisk));
    } catch (error) {
      // Only absence is "not found"; a permissions or I/O error is reported as itself.
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
      throw new ContentError(file, `image "${src}" not found at ${onDisk}`);
    }
    const size = imageSize(bytes);
    if (!size.width || !size.height) {
      throw new ContentError(file, `image "${src}" has no readable dimensions`);
    }
    const placeholder = (await assetPlaceholders())[src]?.lqip;
    // build:assets derives one for every raster content image, so a miss is a stale manifest.
    if (!placeholder && isRaster(src) && roleOf(src) === "content") {
      throw new ContentError(
        file,
        `image "${src}" has no placeholder in ${ASSET_MANIFEST_PATH}; run npm run build:assets`,
      );
    }
    return { width: size.width, height: size.height, ...(placeholder ? { placeholder } : {}) };
  };
}

/**
 * @param {string} file
 * @param {string} raw
 */
export async function renderPost(file, raw) {
  return renderPostShared({
    file,
    raw,
    expectedSlug: path.basename(file, ".md"),
    resolveImage: makeResolveImage(file),
  });
}
