/**
 * A series is FREE TEXT, unlike a tag, so it is normalised here and nowhere else; the archive
 * builds and resolves its URL through this one function so the two cannot drift.
 */

/**
 * Empty for a name with no alphanumerics; the caller decides what that means.
 *
 * @param {string} name
 * @returns {string}
 */
export function seriesSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Takes the NAME, so no caller can forget to slugify and put two spellings of one URL on the site.
 *
 * @param {string} name
 * @returns {string} a site-absolute path
 */
export function seriesPath(name) {
  return `/blog/series/${encodeURIComponent(seriesSlug(name))}`;
}
