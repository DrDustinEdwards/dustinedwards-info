// Rules apply IN ORDER and each consumes its tokens: tag:2019 stays a tag filter only because the
// operator rule runs before the year rule.

export { RRF_K, fuse, toMatchExpression } from "@drdustinedwards/site-helpers";

/**
 * @typedef {object} ParsedQuery
 * @property {string} raw exactly what was typed, for echoing back
 * @property {string[]} terms bare words, ANDed
 * @property {string[]} phrases quoted runs, matched as phrases
 * @property {string[]} tags from `tag:` operators and the ?tag= parameter
 * @property {string[]} types from `type:` operators and the ?type= parameter
 * @property {string[]} bases from `base:` operators and the ?base= parameter: a knowledge base's id (app/kb/search-bases.mjs)
 * @property {number | null} year a bare four-digit year inside the corpus range
 * @property {boolean} isEmpty true when there is nothing to match on
 */

/**
 * @typedef {object} ParseOptions
 * @property {number} [minYear] earliest year the corpus contains
 * @property {number} [maxYear] latest year the corpus contains
 */

/** Narrow enough that 1024 or 8080 stays a search term rather than silently filtering everything. */
const DEFAULT_MIN_YEAR = 2000;

/**
 * @param {string} input
 * @param {ParseOptions} [options]
 * @returns {ParsedQuery}
 */
export function parseQuery(input, options = {}) {
  const raw = input ?? "";
  const minYear = options.minYear ?? DEFAULT_MIN_YEAR;
  // Not computed at module scope: that would freeze the ceiling at deploy time
  // and stop accepting next year's posts after New Year.
  const maxYear = options.maxYear ?? new Date().getUTCFullYear() + 1;

  let rest = raw;

  // 1. Quoted phrases first, so an operator inside quotes stays literal text.
  /** @type {string[]} */
  const phrases = [];
  rest = rest.replace(/"([^"]+)"/g, (/** @type {string} */ _m, /** @type {string} */ phrase) => {
    const trimmed = phrase.trim();
    if (trimmed) phrases.push(trimmed);
    return " ";
  });

  /** @type {string[]} */
  const tags = [];
  /** @type {string[]} */
  const types = [];
  /** @type {string[]} */
  const bases = [];
  rest = rest.replace(
    /\b(tag|type|base):([^\s]+)/gi,
    (/** @type {string} */ _m, /** @type {string} */ field, /** @type {string} */ value) => {
      const clean = value.trim().toLowerCase();
      if (clean) {
        const f = field.toLowerCase();
        if (f === "tag") tags.push(clean);
        else if (f === "base") bases.push(clean);
        else types.push(clean);
      }
      return " ";
    },
  );

  // 3. A bare year becomes a date filter: prose rarely spells out its own date, so as text it matches nothing.
  /** @type {number | null} */
  let year = null;
  const tokens = rest.split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const terms = [];
  for (const token of tokens) {
    if (year === null && /^\d{4}$/.test(token)) {
      const candidate = Number(token);
      if (candidate >= minYear && candidate <= maxYear) {
        year = candidate;
        continue;
      }
    }
    terms.push(token);
  }

  return {
    raw,
    terms,
    phrases,
    tags,
    types,
    bases,
    year,
    isEmpty: terms.length === 0 && phrases.length === 0,
  };
}

/**
 * Filter-only queries (tag:x, a bare year) leave no text for fts5, so they take the browse path.
 *
 * @param {ParsedQuery} parsed
 * @returns {boolean}
 */
export function hasFilters(parsed) {
  return parsed.tags.length > 0 || parsed.types.length > 0 || parsed.bases.length > 0 || parsed.year !== null;
}
