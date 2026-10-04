import { createContext, type RouterContextProvider } from "react-router";

export type Timings = Array<{ name: string; ms: number }>;

// Shared so the `admin.tsx` middleware and child loaders write into one Server-Timing header.
export const timingsContext = createContext<{ timings?: Timings }>({});

/**
 * Whether this request collects Server-Timing marks: every admin request (a signed-in person's, never cached, so the
 * numbers cost nothing to read and are there when a page is slow), and any other page that asks with `?timing=1`.
 */
export function wantsTiming(url: URL) {
  return url.searchParams.get("timing") === "1" || url.pathname === "/admin" || url.pathname.startsWith("/admin/");
}

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
    into.push({ name, ms: performance.now() - start });
  }
}

/**
 * Runs a loader body as one timed mark, `loader_total` unless named. Wrapping the body rather than
 * pushing before the last return is what counts the early returns and the throws too.
 */
export function timedLoader<T>(
  context: Readonly<RouterContextProvider>,
  fn: (timings: Timings | undefined) => Promise<T>,
  name = "loader_total",
): Promise<T> {
  const timings = context.get(timingsContext).timings;
  return timed(timings, name, () => fn(timings));
}

// Names must be tokens: one malformed name makes the browser silently discard the whole header.
export function serverTiming(timings: Timings) {
  return timings
    .map(({ name, ms }) => `${name.replace(/[^A-Za-z0-9_-]/g, "")};dur=${ms.toFixed(1)}`)
    .join(", ");
}
