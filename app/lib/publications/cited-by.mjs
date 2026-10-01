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

/**
 * The citation counts an OpenAlex snapshot holds, as publication_citations rows, so a count is never blank on
 * a database that has none yet. The lower-cased DOI is the key, as the table keys it. sync:content and the
 * Worker's sync_publications both seed from here.
 *
 * @param {unknown} artifact the parsed publications.cited-by.json
 * @param {string} source what to call the artifact in the error
 * @returns {Array<{ doi: string, count: number, url: string | null, fetchedAt: string }>}
 */
export function citationSeedsFrom(artifact, source) {
  const { fetchedAt, works } = /** @type {{ fetchedAt?: unknown, works?: Record<string, { openalexId?: string | null, total?: number }> }} */ (artifact);
  if (typeof fetchedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fetchedAt) || !works) {
    throw new Error(`${source} carries no fetchedAt date or no works, so the citation counts cannot be seeded.`);
  }
  return Object.entries(works).map(([doi, work]) => ({
    doi: doi.trim().toLowerCase(),
    count: Number(work.total ?? 0),
    url: work.openalexId ? `https://openalex.org/${work.openalexId}` : null,
    fetchedAt,
  }));
}
