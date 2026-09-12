/**
 * Reading the committed cited-by artifact.
 *
 * ## WHY THIS IS A MODULE AND NOT A PROPERTY ACCESS
 *
 * `import artifact from "../../data/publications.cited-by.json"` gives
 * TypeScript a LITERAL type: an object with 36 known DOI keys, each with its own
 * shape, and `citing: never[]` on the ones that happen to be empty today.
 * Indexing that with a runtime string is an error, and the fix that suggests
 * itself is a cast at the call site. That cast would then be in every consumer,
 * and each would be free to spell the shape slightly differently.
 *
 * So the shape is declared ONCE here and the artifact is read through it. Two
 * consumers so far, the paper page and (later) the markdown twin, and both get
 * the same answer for a DOI the artifact does not carry: `null`, which is a
 * real state. A paper fetched before its first citation has `total: 0` and an
 * empty list; a paper absent from the artifact entirely has never been fetched,
 * and those are different facts.
 */

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
 * One paper's citing works, or null when the artifact does not carry it.
 *
 * @param {unknown} artifact the parsed publications.cited-by.json
 * @param {string} doi as deposited
 * @returns {CitedBy | null}
 */
export function citedByFor(artifact, doi) {
  const works = /** @type {{ works?: Record<string, CitedBy> }} */ (artifact)?.works;
  if (!works || typeof works !== "object") return null;
  /*
   * OWN PROPERTY ONLY, the hazard `slug-redirect.mjs` and `pdf-redirect.mjs`
   * both document: a plain object inherits `constructor` and `toString`, and a
   * bare lookup for a DOI spelled like one would return a function.
   */
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
 * The date the artifact was read, for the label beside the list.
 *
 * @param {unknown} artifact
 * @returns {string | null}
 */
export function citedByFetchedAt(artifact) {
  const value = /** @type {{ fetchedAt?: unknown }} */ (artifact)?.fetchedAt;
  return typeof value === "string" && value.length > 0 ? value : null;
}
