// Old flat PDF URLs redirect into /publications/<slug>/, because a published URL is a promise. A map,
// not a rule: the old names are curated ids with no function to the DOI slug. The map is an argument,
// not an import, because vite and node --test disagree about JSON import attributes.

const PUBLICATIONS_PREFIX = "/publications/";

/**
 * Returns a path the caller resolves against the request's own origin, so it cannot name another host.
 *
 * @param {string} pathname the request's pathname, already decoded by URL
 * @param {Record<string, string>} map old path to new path, both site-absolute
 * @returns {string | null}
 */
export function pdfRedirectTarget(pathname, map) {
  if (typeof pathname !== "string") return null;
  if (!map || typeof map !== "object") return null;
  // Scoped to the prefix so the map cannot answer for paths outside this directory.
  if (!pathname.startsWith(PUBLICATIONS_PREFIX)) return null;

  // Own property only: a path spelled like constructor would hit an inherited key.
  if (!Object.hasOwn(map, pathname)) return null;

  const target = map[pathname];
  if (typeof target !== "string" || target.length === 0) return null;
  if (!target.startsWith(PUBLICATIONS_PREFIX)) return null;
  return target;
}

/**
 * Matches postRedirectStatus on purpose, so the two redirect helpers never disagree.
 *
 * @param {string} method
 * @returns {number}
 */
export function pdfRedirectStatus(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "GET" || m === "HEAD" ? 301 : 308;
}

/**
 * Skips anything with a dot so the PDF inside the directory still reaches the asset handler.
 *
 * @param {string} pathname
 * @returns {string | null} the canonical path, or null
 */
export function paperSlashTarget(pathname) {
  if (typeof pathname !== "string") return null;
  if (!pathname.startsWith(PUBLICATIONS_PREFIX)) return null;
  const rest = pathname.slice(PUBLICATIONS_PREFIX.length);
  if (rest.length === 0) return null;
  if (rest.includes("/")) return null;
  if (rest.includes(".")) return null;
  return `${pathname}/`;
}
