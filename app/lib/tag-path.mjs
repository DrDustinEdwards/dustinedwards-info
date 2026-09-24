/**
 * Encoded, not re-slugified: `tags.slug` is already the write path's normalization.
 *
 * @param {string} slug a `tags.slug` value
 * @returns {string} a site-absolute path
 */
export function tagPath(slug) {
  return `/blog/tags/${encodeURIComponent(slug)}`;
}
