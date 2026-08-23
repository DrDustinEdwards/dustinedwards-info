/**
 * THE ONE OWNER of "this timestamp, as a date a person reads".
 *
 * ## Why one owner, and what the three copies disagreed about
 *
 * Write-quality audit, the formatting nit. Three `formatDate` helpers existed:
 * `blog.$slug.tsx`, `blog._index.tsx` and `preview-links.tsx`. The first two
 * were identical character for character. The third was NOT, and the difference
 * was not cosmetic:
 *
 *   - the blog pair handed an unparseable value straight to
 *     `toLocaleDateString`, which answers `"Invalid Date"` and RENDERS IT, so a
 *     bad `publishAt` reaching a public post shows a reader the string
 *     "Invalid Date" under the title;
 *   - `preview-links` guarded `Number.isNaN` and said "an unknown date".
 *
 * So the odd one out was the CORRECT one. Consolidating on the majority spelling
 * would have propagated the defect to the file that did not have it, which is
 * the argument for reading all copies before picking one rather than counting
 * them.
 *
 * This owner takes the guarded form and returns `null`, because null is a value
 * each caller can decide about and `"Invalid Date"` is not.
 *
 * ## UTC IS THE POINT, NOT A DETAIL
 *
 * Every caller renders on the server AND after hydration. A local-zone format
 * produces different text in those two passes for any reader east or west of
 * the server, which React reports as a hydration mismatch and repairs by
 * throwing the server's markup away. UTC is what makes the two passes agree.
 *
 * @see test/long-date.test.mjs
 */

/**
 * A timestamp as "January 5, 2026", in UTC, or null if there is no date.
 *
 * NULL COVERS BOTH ABSENCE AND NONSENSE, deliberately. A caller that wants to
 * distinguish "no date" from "a date I cannot read" does not exist here, and a
 * caller that renders the result needs exactly one question answered: is there
 * something to show?
 *
 * @param {string | Date | number | null | undefined} value
 * @returns {string | null}
 */
export function longDateUTC(value) {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
