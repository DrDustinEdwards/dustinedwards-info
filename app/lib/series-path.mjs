import { SLUG_PATTERN } from "./content/pipeline.mjs";

/**
 * A series name, and the URL it lives at.
 *
 * ## WHY A SERIES NEEDS A SLUG AND A TAG DOES NOT
 *
 * A tag's slug IS its name: `sync-content.mjs` writes
 * `INSERT INTO tags (slug, name) VALUES (tag, tag)`, and `parseTags` has
 * already lowercased and trimmed it, so a tag is a single lowercase token and
 * goes into a path unchanged.
 *
 * `series` is FREE TEXT. It is `z.string().min(1)` in the schema, an author
 * types it as a title, and "The Doorbell Gets Built" is what one looks like. So
 * the two are not the same problem and applying the tag rule to a series would
 * put spaces and capitals in a path: `/blog/series/The%20Doorbell%20Gets%20Built`
 * reads nothing like `/blog/tags/cloudflare` or `/blog/<post-slug>`, which are
 * the two URL shapes this site already teaches a reader.
 *
 * ONE NORMALISATION, and this is it. Nothing else lowercases or hyphenates a
 * series: the archive builds its URL here and resolves an incoming one here,
 * so the two cannot drift.
 *
 * NO STORED COLUMN, deliberately. The slug is derived on read rather than
 * migrated into `posts`, because a stored copy is a second answer that a
 * hand-edited markdown commit can put out of step with the name beside it. The
 * set of series is tiny, and resolving one is a scan of distinct names.
 *
 * NOTHING TO MIGRATE: measured 2026-09-04, the corpus and D1 carry no series at
 * all, so this decision costs no rewrite and no redirect.
 */

/**
 * A series name to its URL segment: lowercase, and anything that is not a
 * letter or digit becomes a single hyphen.
 *
 * Produces a value matching `SLUG_PATTERN`, the same shape a post slug and a
 * tag already take, or an empty string for a name with no alphanumerics at all.
 * The caller decides what an empty slug means; this function does not guess.
 *
 * @param {string} name
 * @returns {string}
 */
export function seriesSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Whether a derived slug is one this site will route to.
 *
 * @param {string} slug
 * @returns {boolean}
 */
export function isRoutableSeriesSlug(slug) {
  return SLUG_PATTERN.test(slug);
}

/**
 * The archive URL for a series NAME.
 *
 * Takes the name rather than the slug so no caller has to remember to slugify
 * first, which is the mistake that would put two spellings of one URL on the
 * site. `encodeURIComponent` is belt and braces: `seriesSlug` already emits
 * only `[a-z0-9-]`, and encoding it costs nothing and cannot be wrong.
 *
 * @param {string} name
 * @returns {string} a site-absolute path
 */
export function seriesPath(name) {
  return `/blog/series/${encodeURIComponent(seriesSlug(name))}`;
}
