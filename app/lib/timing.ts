/**
 * Attribution for a slow route, reported as `Server-Timing`.
 *
 * A real response header rather than a log, because the question being asked is
 * about the LIVE path and a header can be read by whatever is already making
 * the request. Nothing here changes behaviour: the marks are collected and
 * emitted, and a route that never creates a collector pays nothing.
 *
 * **Why this exists.** `/blog` measured 276ms p50 against 35ms for `/` and 99ms
 * for `/phage-discovery`, both of which are also uncacheable HTML. The cause was
 * SUSPECTED to be three D1 queries and that suspicion was wrong in its details:
 * the three calls are already in a `Promise.all`, while `listBlogPosts` performs
 * three SERIAL round trips inside itself. Guessing which of those matters is
 * exactly what this replaces.
 */

export type Timings = Array<{ name: string; ms: number }>;

/**
 * Runs `fn`, recording how long it took.
 *
 * `into` is optional so a caller that does not want timing passes nothing and
 * the wrapper degrades to a plain call. That keeps the instrumentation out of
 * every other caller's signature.
 */
export async function timed<T>(
  into: Timings | undefined,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!into) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    // In a `finally`, so a throwing call still reports the time it burned
    // before failing. A slow path that also errors is the one most worth
    // measuring and the easiest to lose.
    into.push({ name, ms: performance.now() - start });
  }
}

/**
 * The `Server-Timing` header value.
 *
 * Names are restricted to a token, so anything unusual is stripped rather than
 * emitted as a malformed header that a browser will silently discard whole.
 */
export function serverTiming(timings: Timings) {
  return timings
    .map(({ name, ms }) => `${name.replace(/[^A-Za-z0-9_-]/g, "")};dur=${ms.toFixed(1)}`)
    .join(", ");
}
