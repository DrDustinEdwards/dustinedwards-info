/**
 * Query parsing and rank fusion for site search.
 *
 * Platform independent on purpose: it turns a string a person typed into a
 * structure, and knows nothing about fts5 or D1. The same parse drives the
 * server-rendered page, the JSON endpoint and the palette.
 *
 * A .mjs rather than a .ts for the reason app/lib/content/pipeline.mjs is: the
 * Worker imports it AND the tests can import it, so they exercise exactly the
 * parser that ships rather than a copy of its rules.
 *
 * Rules apply IN ORDER and each consumes its tokens, so a token cannot be read
 * twice. The order matters: `tag:2019` must stay a tag filter rather than
 * becoming a year, which only holds because the operator rule runs first.
 */

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

/**
 * The corpus range defaults wide enough to cover anything this site will hold
 * and narrow enough that a number like 1024 or 8080 stays a search term rather
 * than silently filtering every result away.
 */
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

  // 2. Field operators.
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

  // 3. A bare year becomes a date filter and leaves the text query.
  //
  // The highest-value rule in the parser. Treating a year as literal text is
  // the single most common reason a site search feels stupid: the query goes
  // looking for the string "2019" in prose that never spells its own date out,
  // and returns nothing at all.
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
 * True when the query carries something to narrow by, independent of any text.
 *
 * This is the browse-path predicate. `tag:cloudflare`, a bare `2026`, and a
 * facet chip clicked from an empty box all parse into filters and leave no text
 * behind, so `toMatchExpression` correctly returns null and there is nothing to
 * hand fts5. Without this, those queries fall through the index path and return
 * nothing, which is how the parser's best rule ends up looking like a bug.
 *
 * Lives here rather than in search.server.ts so the pure gate can assert it.
 * Found live on 2026-07-28: every filter-only query returned 0 on the deploy.
 *
 * @param {ParsedQuery} parsed
 * @returns {boolean}
 */
export function hasFilters(parsed) {
  return parsed.tags.length > 0 || parsed.types.length > 0 || parsed.year !== null;
}

/**
 * Quotes one token as an fts5 string literal.
 *
 * Everything a visitor types is quoted rather than filtered. fts5 has its own
 * query language (AND, OR, NOT, NEAR, `*`, `^`, column filters), so an unquoted
 * user string is not merely a bad search: it is a syntax error the moment
 * someone types a hyphen, and the word NEAR would silently change what the
 * query means. Doubling embedded quotes is the whole escape.
 *
 * @param {string} token
 * @returns {string}
 */
function literal(token) {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * Builds the fts5 MATCH expression for a parsed query.
 *
 * Terms are ANDed, which is what a person means by typing two words. A
 * multi-word literal is already a phrase query to fts5.
 *
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
 * Reciprocal rank fusion over any number of ranked lists.
 *
 * RANK BASED, NEVER SCORE BASED, and that is the reason the two indexes can
 * exist at all. bm25 values from two tables with different tokenizers and
 * different average document lengths are not comparable on value: the identity
 * index scores prose-free titles, the prose index scores paragraphs, and the
 * same document legitimately scores an order of magnitude apart in the two.
 * Adding or averaging them would let whichever index happens to produce larger
 * magnitudes decide every result. Rank is the one thing the two lists agree on
 * the meaning of.
 *
 * k damps the top of each list so that being first in one index does not
 * automatically beat being second in both. 60 is the value from the original
 * RRF paper and the constant the architecture ratified.
 *
 * `ranks` and `contributions` are RECORDED RATHER THAN RECOMPUTED. Both were
 * already computed here as per-iteration locals and thrown away; keeping them is
 * what lets `/playground`'s search anatomy show the k=60 arithmetic without a
 * second implementation of fusion anywhere. They are positionally parallel to
 * `sources`, so `sources[i]`, `ranks[i]` and `contributions[i]` describe the same
 * appearance of the item in one list, and `contributions` sums to `score`.
 *
 * Additive on purpose: no existing field changed meaning or position, so every
 * current caller reads exactly what it read before.
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
