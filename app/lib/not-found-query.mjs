// Plain .mjs so `node --test` can import it; the types are JSDoc under checkJs.

/**
 * The words of a missing address, to start the 404 page's search box with: the last path segment
 * with any file extension off, split on everything that is not a letter or digit. Number-only words
 * are dropped, because a bare year is a search filter and an old dated address would otherwise
 * narrow the search to that year. Percent escapes are dropped rather than decoded, since a malformed
 * one would throw. Empty when nothing useful is left, and the box then shows its placeholder.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function notFoundQuery(pathname) {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  const last = segments.at(-1) ?? "";
  const words = last
    .replace(/%[0-9A-Fa-f]{2}/g, " ")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !/^\p{N}+$/u.test(word));
  return words.join(" ").slice(0, 100).trim();
}
