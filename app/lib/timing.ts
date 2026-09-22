/**
 * Attribution for a slow route, reported as `Server-Timing`.
 *
 * A real response header rather than a log, because the question is about the LIVE path and a header
 * can be read by whatever is already making the request. Nothing here changes behavior: the marks
 * are collected and emitted, and a route that never creates a collector pays nothing.
 */

import { createContext } from "react-router";

export type Timings = Array<{ name: string; ms: number }>;

/**
 * The per-request collector, so a MIDDLEWARE and a child LOADER write into one list and the route
 * emits a single header. The admin plane needs it because the auth gate runs in `admin.tsx` and the
 * queries live in child routes.
 *
 * Held in a WRAPPER OBJECT whose `timings` is optional rather than as a nullable context value, so
 * the context default describes "nobody asked" without the type admitting undefined.
 */
export const timingsContext = createContext<{ timings?: Timings }>({});

/** True when this request asked to be measured. `?timing=1`, nothing else. */
export function wantsTiming(url: URL) {
  return url.searchParams.get("timing") === "1";
}

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
 * Runs `fn` and records how long it took, for a SYNCHRONOUS call.
 *
 * `createAuth()` is the reason this exists: it is synchronous, so wrapping it in the async `timed`
 * would add an await to the UNINSTRUMENTED path as well. That would be an instrument changing the
 * thing it measures, which is the one thing an instrument may not do.
 *
 * Same contract as `timed`: no collector, no cost.
 */
export function timedSync<T>(into: Timings | undefined, name: string, fn: () => T): T {
  if (!into) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
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
