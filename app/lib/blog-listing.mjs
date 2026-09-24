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

/** Rows the home "Start here" list shows, lead included. Five, per 02-home.html §4. See `startHere`. */
export const HOME_CARDS = 5;

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
 * reads as a duplicate", which was the argument against the behavior the next
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
 * what the one-owner rule says belongs to a gate or to nowhere, and the only reason
 * these survive is that they are DATED observations about a corpus rather than
 * standing claims about the code.
 *
 * MATCHED BY SLUG, not by object identity. The two arrays hold the same objects
 * today, but identity is not a property this should rest on: a serialization
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


/**
 * The three machine facts a listing's evidence row states: how many posts, the years they span,
 * and how long they are to read.
 *
 * THEY DESCRIBE THE FILTERED LIST, NOT THE CORPUS. A reader who has narrowed to one tag is
 * looking at that list, so a row stating the whole blog's span over a seven-post view would be
 * true of something the page does not show. `listBlogPosts` counts all three in SQL over the same
 * `where` the rows come from, which is what makes that possible at all.
 *
 * HERE RATHER THAN IN THE ROUTE, because three routes render this row and a rule written three
 * times is a rule that disagrees with itself the first time one copy changes. A route module is
 * also the wrong place to import from: it carries a loader and a default export, and a second
 * route importing it would pull both into its own module graph.
 *
 * A NULL IS NOT A ZERO. An empty list has no first year and nothing to read, and `EvidenceRow`
 * omits itself below three facts rather than padding to three, so the row simply does not appear
 * on a page that cannot fill it.
 *
 * @param {number} total posts in the whole filtered list, not on this page of it
 * @param {{ firstYear: string | null, lastYear: string | null, minutes: number | null }} span
 * @returns {(string | null)[]} three facts, in the row's order
 */
export function listingFacts(total, span) {
  const years =
    span.firstYear && span.lastYear
      ? span.firstYear === span.lastYear
        ? span.firstYear
        : `${span.firstYear} to ${span.lastYear}`
      : null;
  /* Hours past two, minutes below it: "132 minutes of reading" is a number the reader has to
     divide, and "1 hour" rounded from 38 minutes is a number that is wrong. */
  const reading = span.minutes
    ? span.minutes >= 120
      ? `${Math.round(span.minutes / 60)} hours of reading`
      : `${span.minutes} minutes of reading`
    : null;
  return [`${total} post${total === 1 ? "" : "s"}`, years, reading];
}
