// The shape is declared once here: the JSON import's literal type cannot be indexed by a string. null
// (never fetched) and total 0 (fetched, uncited) are different facts.

/**
 * @typedef {object} CitingWork
 * @property {string | null} title
 * @property {number | null} year
 * @property {string | null} venue
 * @property {string | null} doi bare DOI name, not a URL
 */

/**
 * @typedef {object} CitedBy
 * @property {string | null} openalexId
 * @property {number} total the TRUE count, which may exceed `citing.length`
 * @property {CitingWork[]} citing newest first, capped by the artifact
 */

/**
 * @param {unknown} artifact the parsed publications.cited-by.json
 * @param {string} doi as deposited
 * @returns {CitedBy | null}
 */
export function citedByFor(artifact, doi) {
  const works = /** @type {{ works?: Record<string, CitedBy> }} */ (artifact)?.works;
  if (!works || typeof works !== "object") return null;
  // Own property only: a DOI spelled like constructor would return a function.
  if (!Object.hasOwn(works, doi)) return null;
  const entry = works[doi];
  if (!entry || typeof entry !== "object") return null;
  return {
    openalexId: entry.openalexId ?? null,
    total: Number(entry.total ?? 0),
    citing: Array.isArray(entry.citing) ? entry.citing : [],
  };
}

/**
 * @param {unknown} artifact
 * @returns {string | null}
 */
export function citedByFetchedAt(artifact) {
  const value = /** @type {{ fetchedAt?: unknown }} */ (artifact)?.fetchedAt;
  return typeof value === "string" && value.length > 0 ? value : null;
}
