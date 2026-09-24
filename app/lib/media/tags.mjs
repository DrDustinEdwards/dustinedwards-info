// A column, not a join table like posts: media tags have no public page, and search stays one LIKE chain.
// Stored DELIMITER-WRAPPED (`,alpha,beta,`) so an exact match is `LIKE '%,art,%'` and misses `chart`;
// the empty list is "" so an untagged row cannot match `%,%`.

export const TAG_DELIMITER = ",";

export const MAX_TAG_LENGTH = 32;

export const MAX_TAGS = 12;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normaliseTag(raw) {
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
export function normaliseTags(input) {
  const parts = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(TAG_DELIMITER)
      : [];
  const seen = new Set();
  for (const part of parts) {
    const tag = normaliseTag(part);
    if (tag) seen.add(tag);
  }
  return [...seen].sort().slice(0, MAX_TAGS);
}

/**
 * @param {unknown} input
 * @returns {string}
 */
export function serialiseTags(input) {
  const tags = normaliseTags(input);
  if (tags.length === 0) return "";
  return `${TAG_DELIMITER}${tags.join(TAG_DELIMITER)}${TAG_DELIMITER}`;
}

/**
 * @param {unknown} stored
 * @returns {string[]}
 */
export function parseTags(stored) {
  if (typeof stored !== "string" || stored === "") return [];
  return normaliseTags(stored);
}

/**
 * Null means "no filter", never a needle: `%,,%` would match every tagged row.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function exactTagNeedle(raw) {
  const tag = normaliseTag(raw);
  if (!tag) return null;
  return `%${TAG_DELIMITER}${tag}${TAG_DELIMITER}%`;
}
