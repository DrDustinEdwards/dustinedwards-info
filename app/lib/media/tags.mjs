// A column, not a join table like posts: media tags have no public page. Stored DELIMITER-WRAPPED (`,alpha,beta,`),
// the empty list as "", the form every row has held since the column was added; the media library's store reads and
// writes it here (app/db/media.ts), and filters by tag in the Worker.

const TAG_DELIMITER = ",";

export const MAX_TAG_LENGTH = 32;

export const MAX_TAGS = 12;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeTag(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .split(TAG_DELIMITER)
    .join(" ")
    .trim()
    .replace(/\s+/g, "-")
    // Never a `%` or `_`: they are LIKE wildcards and would turn a stored value into a pattern.
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Sorted so the same set always stores the same bytes, whatever the typing order.
 *
 * @param {unknown} input
 * @returns {string[]}
 */
export function normalizeTags(input) {
  const parts = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(TAG_DELIMITER)
      : [];
  const seen = new Set();
  for (const part of parts) {
    const tag = normalizeTag(part);
    if (tag) seen.add(tag);
  }
  return [...seen].sort().slice(0, MAX_TAGS);
}

/**
 * @param {unknown} input
 * @returns {string}
 */
export function serializeTags(input) {
  const tags = normalizeTags(input);
  if (tags.length === 0) return "";
  return `${TAG_DELIMITER}${tags.join(TAG_DELIMITER)}${TAG_DELIMITER}`;
}

/**
 * @param {unknown} stored
 * @returns {string[]}
 */
export function parseTags(stored) {
  if (typeof stored !== "string" || stored === "") return [];
  return normalizeTags(stored);
}
