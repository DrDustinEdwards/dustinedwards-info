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

/**
 * Picks the hero post and returns the list with it REMOVED.
 *
 * Before 2026-08-21 the route found the featured post inside the page's own
 * array and rendered it above that same array unchanged, so it appeared twice.
 * The route's own comment read "repeating it above a list it already appears in
 * reads as a duplicate", which was the argument against the behaviour the next
 * three lines introduced.
 *
 * HERE RATHER THAN INLINE IN THE LOADER, because the condition cannot be reached
 * from the current corpus: measured 2026-08-21, 0 of 12 posts carry
 * `featured: true`, so the duplicate was LATENT and a rendered page proves
 * nothing either way. Extracted so `test/blog-listing.test.mjs` can prove it.
 *
 * MATCHED BY SLUG, not by object identity. The two arrays hold the same objects
 * today, but identity is not a property this should rest on: a serialisation
 * boundary anywhere upstream would break it silently, and slug is unique by
 * schema.
 *
 * `eligible` is the CALLER's decision. The hero shows only on the unfiltered
 * first page, and whether this request is that page depends on the tag, the
 * year and the page number, none of which belong in here.
 *
 * @template {{ slug: string, featured?: boolean }} T
 * @param {T[]} posts the page of posts, in order
 * @param {boolean} eligible whether this request may show a hero at all
 * @returns {{ featured: T | null, posts: T[] }}
 */
export function splitFeatured(posts, eligible) {
  if (!eligible) return { featured: null, posts };
  const featured = posts.find((post) => post.featured) ?? null;
  if (!featured) return { featured: null, posts };
  return { featured, posts: posts.filter((post) => post.slug !== featured.slug) };
}
