/** Reciprocal rank fusion constant. See fuse(). */
export const RRF_K = 60;

/**
 * Every token is quoted: fts5 has its own query language, so unquoted input breaks on a hyphen and NEAR silently changes the
 * meaning. Doubling embedded quotes is the whole escape.
 *
 * @param {string} token
 * @returns {string}
 */
export function ftsLiteral(token) {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * An FTS5 MATCH expression from already-split words and phrases, every one a literal, all ANDed.
 *
 * @param {{ terms: string[], phrases?: string[] }} parsed
 * @param {boolean} [prefix] when true the LAST term also matches as a prefix, so "cloudf" finds "cloudflare" while someone is
 *   still typing. Only the last term, because the earlier ones are complete words the moment a space follows them.
 * @returns {string | null} null when there is nothing to match on
 */
export function toMatchExpression(parsed, prefix = false) {
  /** @type {string[]} */
  const parts = [];
  for (const phrase of parsed.phrases ?? []) parts.push(ftsLiteral(phrase));
  parsed.terms.forEach((term, i) => {
    const isLast = i === parsed.terms.length - 1;
    parts.push(prefix && isLast ? `${ftsLiteral(term)}*` : ftsLiteral(term));
  });
  if (parts.length === 0) return null;
  return parts.join(" AND ");
}

/**
 * Rank based, never score based: bm25 from two indexes with different tokenizers is not comparable on value. k = 60 is the
 * original RRF paper's constant. ranks and contributions are parallel to sources.
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
        scores.set(item.uid, { item, score: contribution, sources: [listIndex], ranks: [rank], contributions: [contribution] });
      }
    });
  });

  return [...scores.values()].sort((a, b) => b.score - a.score);
}
