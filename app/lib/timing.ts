import { createContext } from "react-router";

export type Timings = Array<{ name: string; ms: number }>;

// Shared so the `admin.tsx` middleware and child loaders write into one Server-Timing header.
export const timingsContext = createContext<{ timings?: Timings }>({});

export function wantsTiming(url: URL) {
  return url.searchParams.get("timing") === "1";
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

// For synchronous calls like `createAuth()`: the async `timed` would add an await to the unmeasured path.
export function timedSync<T>(into: Timings | undefined, name: string, fn: () => T): T {
  if (!into) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    into.push({ name, ms: performance.now() - start });
  }
}

// Names must be tokens: one malformed name makes the browser silently discard the whole header.
export function serverTiming(timings: Timings) {
  return timings
    .map(({ name, ms }) => `${name.replace(/[^A-Za-z0-9_-]/g, "")};dur=${ms.toFixed(1)}`)
    .join(", ");
}
