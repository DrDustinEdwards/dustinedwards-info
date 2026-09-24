export const POSTS_PER_PAGE = 10;

export const HOME_CARDS = 5;

/**
 * @param {number} position 1-based
 * @param {number} [perPage]
 */
export function pageForPosition(position, perPage = POSTS_PER_PAGE) {
  return Math.floor((position - 1) / perPage) + 1;
}

/**
 * An empty corpus still has one page, because /blog renders an empty state rather than a 404.
 *
 * @param {number} total
 * @param {number} [perPage]
 */
export function pageCount(total, perPage = POSTS_PER_PAGE) {
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Returns the list with the hero REMOVED, or it renders twice. Matched by slug, not identity,
 * because a serialization boundary upstream would silently break identity.
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
 * A pure function rather than SQL because the offline machine-readable check renders this section
 * without a database. With no featured post the newest leads. `others` must exclude the featured
 * post or it prints twice.
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
  const recent = featuredRows[0] ? others.slice(0, cards - 1) : others.slice(1, cards);
  return { featured: lead, recent };
}


/**
 * The facts describe the FILTERED list, not the corpus: a tag view stating the whole blog's span
 * would be true of something the page does not show. A null is not a zero; the row omits itself.
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
  // Hours only past two: "1 hour" rounded from 38 minutes would be wrong.
  const reading = span.minutes
    ? span.minutes >= 120
      ? `${Math.round(span.minutes / 60)} hours of reading`
      : `${span.minutes} minutes of reading`
    : null;
  return [`${total} post${total === 1 ? "" : "s"}`, years, reading];
}
