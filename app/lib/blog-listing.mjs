/**
 * The blog index's pagination shape, in ONE place.
 *
 * There were two copies of the page size before this module: `PER_PAGE` in
 * `app/routes/blog._index.tsx` and a `?? 10` default in `listBlogPosts`. They
 * agreed, but nothing made them agree, and `verify-live.mjs` was about to become
 * a third. That is the drift this repo already gated against for the backup
 * table list and for the shiki grammar list, so it gets the same treatment.
 *
 * A `.mjs` deliberately, like `query.mjs` and `publish-policy.mjs`: the Worker
 * imports it and a plain Node script can import it too, which is what lets the
 * live harness derive an expectation instead of restating a number.
 */

/** Posts per page on /blog. */
export const POSTS_PER_PAGE = 10;

/**
 * Which page a post at a 1-based position in the ordered listing lands on.
 *
 * @param {number} position 1-based
 * @param {number} [perPage]
 */
export function pageForPosition(position, perPage = POSTS_PER_PAGE) {
  return Math.floor((position - 1) / perPage) + 1;
}

/**
 * How many pages a corpus of this size occupies. An empty corpus still has one
 * page, because /blog renders an empty state rather than a 404.
 *
 * @param {number} total
 * @param {number} [perPage]
 */
export function pageCount(total, perPage = POSTS_PER_PAGE) {
  return Math.max(1, Math.ceil(total / perPage));
}
