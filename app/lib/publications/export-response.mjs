/**
 * What every publication export route shares: the response headers, and which
 * records the whole-list exports carry.
 *
 * Five routes need both (`.bib`, `.ris`, `.json`, and the two per-paper forms)
 * and the drift this module prevents is the ordinary one: five copies of a
 * header object where one grows a `Vary` and the others do not, or four that
 * filter the corpus and one that does not.
 */

import { ASSET_PREFIX } from "../media/classify.mjs";

/**
 * Types the whole-list exports carry, which is the index's list.
 *
 * The same set `publications.tsx` calls SHOWCASE_TYPES, and it is HERE rather
 * than imported from the route because a route module drags React and a loader
 * into anything that imports it. This is the second statement of the set and it
 * is deliberate; `check:publications` asserts the two agree, so they cannot
 * come apart silently.
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
 * Headers for a citation export.
 *
 * ## `X-Robots-Tag: noindex`
 *
 * These are alternative REPRESENTATIONS of pages that are themselves indexable.
 * A search engine that indexed `/publications.bib` would be holding a second
 * copy of the corpus with no prose, competing with the pages that carry the
 * abstracts. The same reasoning `llms.txt` carries.
 *
 * ## `charset=utf-8` ON EVERY ONE
 *
 * The corpus carries author names with diacritics on 12 records (Báez-Flores,
 * Michèle, María Alejandra Mussi) and a reference manager that guesses the
 * encoding gets them wrong. Stated rather than defaulted.
 *
 * ## `Content-Disposition: inline` WITH A FILENAME (ruling 127)
 *
 * Inline, so a citation still opens in the tab for the reader who wants to look at it; the
 * filename is what a save or a reference manager's import names the file, and ruling 127 says
 * every file that leaves the site starts `dustin-edwards-`. The prefix is added HERE, so a route
 * names its file and cannot forget the prefix. `check:asset-names` reads the header off each route.
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
