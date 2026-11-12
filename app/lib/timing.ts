import type { RouterContextProvider } from "react-router";
import { getTimings } from "@dustinedwards/site-runtime/context";
import { timed, type Mark } from "@dustinedwards/site-runtime/server-timing";

export type Timings = Mark[];

/**
 * Runs a loader body as one timed mark, `loader_total` unless named. Wrapping the body rather than
 * pushing before the last return is what counts the early returns and the throws too.
 */
export function timedLoader<T>(
  context: Readonly<RouterContextProvider>,
  fn: (timings: Timings | undefined) => Promise<T>,
  name = "loader_total",
): Promise<T> {
  const timings = getTimings(context);
  return timed(timings, name, () => fn(timings));
}
