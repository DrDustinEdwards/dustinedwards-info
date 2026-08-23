/**
 * Call it once per request, however many callers ask.
 *
 * **The property is unobservable without a counter, which is why this is its
 * own module.** A memo that quietly stopped memoizing returns the same value,
 * of the same type, in the same shape. Nothing downstream can tell. Only
 * counting the calls separates the two, and counting needs something
 * injectable to count.
 *
 * ONE IN-FLIGHT PROMISE, not a resolved-value cache. Two callers that ask
 * concurrently, which is exactly what a `Promise.all` in a loader does, share
 * the same pending promise rather than racing two reads. Caching the resolved
 * value would still let both start.
 *
 * NO EXPIRY, NO INVALIDATION, and that is deliberate rather than unfinished.
 * The intended lifetime is one request: the caller creates it, uses it, and
 * drops it. Anything longer is a cache with a freshness policy and belongs to
 * whoever can state that policy.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {() => Promise<T>}
 */
export function memoizeOnce(fn) {
  /** @type {Promise<T> | undefined} */
  let pending;
  return () => (pending ??= fn());
}
