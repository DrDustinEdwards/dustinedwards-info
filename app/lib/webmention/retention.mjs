/**
 * How long a mention that will never render is kept.
 *
 * ONE OWNER, and the admin page IMPORTS these rather than writing the numbers
 * into its own prose. Hard rule 17: a measured value lives where it is applied
 * or nowhere, and a button labeled "older than 30 days" beside a sweep that
 * uses a different constant is the drift that rule exists to prevent.
 *
 * ## WHY TWO WINDOWS AND NOT ONE
 *
 * They answer different questions. A `failed` row is a mention this site could
 * not verify: the source did not answer, or answered and did not carry the
 * link. Almost all of those are noise, and the only reason to keep one at all
 * is so the admin can see a pattern in the week it happens. A `rejected` row is
 * a decision a human made, and the reason to keep it is that a rejected sender
 * who re-sends should not silently reappear as new. Thirty days is long enough
 * to notice the first; ninety is long enough for the second to still be recent
 * when it matters.
 *
 * `unverified` and `pending` are NOT swept at any age. Both are open queue
 * states that the global cap counts, so expiring them would quietly raise the
 * cap; a queue that drains itself is a queue nobody has to moderate. An
 * `unverified` row that never moved is a verification that never ran, which is
 * a defect worth seeing rather than aging out. `approved` is not swept because
 * it is the published record, and H2 renders it.
 */

/** Days a `failed` mention is kept. */
export const FAILED_RETENTION_DAYS = 30;

/** Days a `rejected` mention is kept. */
export const REJECTED_RETENTION_DAYS = 90;

/** @param {number} days */
export function daysInMilliseconds(days) {
  return days * 24 * 60 * 60 * 1000;
}
