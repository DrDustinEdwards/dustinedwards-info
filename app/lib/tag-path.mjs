/**
 * The tag archive's URL, built in ONE place.
 *
 * `.mjs` and dependency-free so every caller can reach it: the two listing
 * surfaces, the post page, the sitemap and the two feed routes all name this
 * address, and a copied template literal in six files is six chances to write
 * `/blog/tag/` where the route says `/blog/tags/`. That mistake produces a 404
 * rather than a type error, which is exactly the kind a gate has to catch
 * instead of the compiler.
 *
 * THE SLUG IS ENCODED AND NOT NORMALISED. `tags.slug` is already the write
 * path's normalization and re-slugifying here would be a second answer to what
 * a tag is called; `encodeURIComponent` only makes that answer safe to put in a
 * path segment.
 *
 * @param {string} slug a `tags.slug` value
 * @returns {string} a site-absolute path
 */
export function tagPath(slug) {
  return `/blog/tags/${encodeURIComponent(slug)}`;
}
