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

/** Cards the home "Start here" section shows, lead included. See `startHere`. */
export const HOME_CARDS = 4;

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
 * HERE RATHER THAN INLINE IN THE LOADER, so `test/blog-listing.test.mjs` can
 * prove it. That was originally justified by the branch being UNREACHABLE:
 * "measured 2026-08-21, 0 of 12 posts carry `featured: true`, so the duplicate
 * was LATENT and a rendered page proves nothing either way."
 *
 * **That measurement is no longer true and the conclusion has inverted.**
 * Re-measured 2026-09-10: 1 of 11 published posts is featured
 * (`ten-years-on-cloudflare`), it sits on `/blog` page 1, and `splitFeatured`
 * finds it there on every unfiltered first-page request. The branch runs in
 * production now, so a rendered page WOULD prove something. The extraction is
 * still right, for the ordinary reason rather than the original one: a test can
 * drive the empty, the found and the ineligible cases in a millisecond each,
 * and a page can only ever show whichever one today's corpus produces.
 *
 * Kept as a dated pair rather than overwritten, because the old number is what
 * makes the reversal legible. This comment went stale the day the flagship was
 * featured and nothing noticed for three weeks; a count in prose is exactly
 * what hard rule 17 says belongs to a gate or to nowhere, and the only reason
 * these survive is that they are DATED observations about a corpus rather than
 * standing claims about the code.
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

/**
 * What the home page's "Start here" section shows, from two ordered lists.
 *
 * ## WHY THIS IS A PURE FUNCTION AND NOT THREE LINES IN THE QUERY
 *
 * `listHomeStartHere` fetches the featured post and the newest non-featured
 * posts as two ordered statements, which is what the `(featured, publish_at)`
 * index is for. Deciding which of those becomes the LEAD is a rule rather than
 * a query, and it has two branches: `check:microformats` renders this section
 * offline and has to produce the same fixture the loader would, and it cannot
 * run SQL. A rule written twice is a rule that disagrees with itself the first
 * time somebody changes one copy.
 *
 * So the SQL supplies the ordering and this supplies the decision. Both callers
 * pass the same two arrays and `test/blog-listing.test.mjs` can drive every
 * branch without a database.
 *
 * ## THE TWO BRANCHES, and the second is ruling 57's own instruction
 *
 * With a featured post it leads and the others fill in behind it. With none,
 * the section shows the `cards` NEWEST and the newest leads. That is not a
 * substituted value: nothing on the home page labels the lead as featured, so
 * "start here" is answered honestly by the newest post. An empty corpus returns
 * a null lead and the section stays dark.
 *
 * `others` must EXCLUDE the featured post, which is how the caller queries it
 * (`featured = 0`). Passing a list that contains it would print it twice.
 *
 * @template {{ slug: string }} T
 * @param {T[]} featuredRows at most one, the featured post
 * @param {T[]} others newest first, none of them featured
 * @param {number} [cards] how many the section shows in total, lead included
 * @returns {{ featured: T | null, recent: T[] }}
 */
export function startHere(featuredRows, others, cards = HOME_CARDS) {
  const lead = featuredRows[0] ?? others[0] ?? null;
  if (lead === null) return { featured: null, recent: [] };
  /*
   * SLICED FROM ONE ARRAY in both branches, so the two cannot come to disagree
   * about order, and the lead is dropped from `others` only when it CAME from
   * there. The featured branch keeps `others` whole because the featured post
   * is not in it.
   */
  const recent = featuredRows[0] ? others.slice(0, cards - 1) : others.slice(1, cards);
  return { featured: lead, recent };
}

