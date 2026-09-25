import { ASSET_PREFIX } from "../media/classify.mjs";

/**
 * A second copy of the index page's set (app/lib/publications/listing.mjs) on purpose.
 * check:machine-readable asserts the two agree.
 *
 * @type {Set<string>}
 */
export const SHOWCASE_TYPES = new Set([
  "article",
  "review",
  "chapter",
  "teaching-resource",
]);

/**
 * noindex: these are alternative representations of indexable pages. charset stated because names
 * carry diacritics. The dustin-edwards- prefix is added here so no route can forget it.
 *
 * @param {string} type the media type, without parameters
 * @param {string} cacheControl
 * @param {string} filename the file's name after the prefix, e.g. `publications.bib`
 */
export function exportHeaders(type, cacheControl, filename) {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(filename)) {
    throw new Error(`exportHeaders: "${filename}" is not a safe download name`);
  }
  return {
    "content-type": `${type}; charset=utf-8`,
    "cache-control": cacheControl,
    "content-disposition": `inline; filename="${ASSET_PREFIX}${filename}"`,
    "x-robots-tag": "noindex",
  };
}
