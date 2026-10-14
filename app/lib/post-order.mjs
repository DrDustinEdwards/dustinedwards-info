// The order posts are listed in, newest first, as one rule for the two places that apply it: the D1 listing
// queries (app/db/posts.ts, newestFirstOrder) and the header's build-time list (scripts/lib/nav-data.mjs).
//
// 1. Publish instant, latest first.
// 2. Posts that share an instant: a series stays together and reads latest part first (the newest part of a
//    series is its newest post). A series sits among unrelated posts where its latest row would.
// 3. Otherwise the later row first. The database breaks that tie by row id; the build cannot see ids, so it
//    passes the slug, because rows are inserted in slug order (scripts/build-content.mjs).
//
// Concretely: sort by instant, then by the group key (the largest tie-break value among the posts sharing the
// instant and series, or the post's own value when it has no series), then by part, then by the tie-break
// value. That is a total order, which "part descending within a series, the tie-break otherwise" alone is not.

/**
 * @template {{ publishAt: string, series: string | null, part: number | null }} P
 * @param {P[]} posts
 * @param {(post: P) => string | number} tie the row id in a database, the slug in the build
 * @returns {P[]} a new array, newest first
 */
export function newestFirst(posts, tie) {
  /** @type {Map<string, string | number>} */
  const latest = new Map();
  const groupOf = (/** @type {P} */ p) => `${p.publishAt}\u0000${p.series}`;
  for (const p of posts) {
    if (p.series === null) continue;
    const seen = latest.get(groupOf(p));
    if (seen === undefined || tie(p) > seen) latest.set(groupOf(p), tie(p));
  }
  const key = (/** @type {P} */ p) => (p.series === null ? tie(p) : /** @type {string | number} */ (latest.get(groupOf(p))));
  const desc = (/** @type {string | number} */ a, /** @type {string | number} */ b) => (a === b ? 0 : a < b ? 1 : -1);
  return [...posts].sort(
    (a, b) => desc(a.publishAt, b.publishAt) || desc(key(a), key(b)) || desc(a.part ?? 0, b.part ?? 0) || desc(tie(a), tie(b)),
  );
}
