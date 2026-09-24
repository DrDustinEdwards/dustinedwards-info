// Rules apply IN ORDER and each consumes its tokens: tag:2019 stays a tag filter only because the
// operator rule runs before the year rule.

/** Reciprocal rank fusion constant. See fuse(). */
export const RRF_K = 60;

/**
 * @typedef {object} ParsedQuery
 * @property {string} raw exactly what was typed, for echoing back
 * @property {string[]} terms bare words, ANDed
 * @property {string[]} phrases quoted runs, matched as phrases
 * @property {string[]} tags from `tag:` operators and the ?tag= parameter
 * @property {string[]} types from `type:` operators and the ?type= parameter
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
  rest = rest.replace(
    /\b(tag|type):([^\s]+)/gi,
    (/** @type {string} */ _m, /** @type {string} */ field, /** @type {string} */ value) => {
      const clean = value.trim().toLowerCase();
      if (clean) {
        if (field.toLowerCase() === "tag") tags.push(clean);
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
  return parsed.tags.length > 0 || parsed.types.length > 0 || parsed.year !== null;
}

/**
 * Every token is quoted: fts5 has its own query language, so unquoted input breaks on a hyphen and NEAR
 * silently changes the meaning. Doubling embedded quotes is the whole escape.
 *
 * @param {string} token
 * @returns {string}
 */
function literal(token) {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * @param {ParsedQuery} parsed
 * @param {boolean} [prefix] when true the LAST term also matches as a prefix,
 *   so "cloudf" finds "cloudflare" while someone is still typing. Only the last
 *   term, because the earlier ones are complete words the moment a space
 *   follows them.
 * @returns {string | null}
 */
export function toMatchExpression(parsed, prefix = false) {
  /** @type {string[]} */
  const parts = [];
  for (const phrase of parsed.phrases) parts.push(literal(phrase));
  parsed.terms.forEach((term, i) => {
    const isLast = i === parsed.terms.length - 1;
    parts.push(prefix && isLast ? `${literal(term)}*` : literal(term));
  });
  if (parts.length === 0) return null;
  return parts.join(" AND ");
}

/**
 * Rank based, never score based: bm25 from two indexes with different tokenizers is not comparable on
 * value. k = 60 is the original RRF paper's constant. ranks and contributions are parallel to sources.
 *
 * @template {{ uid: string }} T
 * @param {T[][]} lists
 * @param {number} [k]
 * @returns {Array<{ item: T, score: number, sources: number[], ranks: number[], contributions: number[] }>}
 */
export function fuse(lists, k = RRF_K) {
  /** @type {Map<string, { item: T, score: number, sources: number[], ranks: number[], contributions: number[] }>} */
  const scores = new Map();

  lists.forEach((list, listIndex) => {
    list.forEach((item, i) => {
      const rank = i + 1;
      const contribution = 1 / (k + rank);
      const existing = scores.get(item.uid);
      if (existing) {
        existing.score += contribution;
        existing.sources.push(listIndex);
        existing.ranks.push(rank);
        existing.contributions.push(contribution);
      } else {
        scores.set(item.uid, {
          item,
          score: contribution,
          sources: [listIndex],
          ranks: [rank],
          contributions: [contribution],
        });
      }
    });
  });

  return [...scores.values()].sort((a, b) => b.score - a.score);
}
