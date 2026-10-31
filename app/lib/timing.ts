import { createContext, type RouterContextProvider } from "react-router";
import { timed, type Mark } from "@dustinedwards/site-runtime/server-timing";

export { timed };
export type Timings = Mark[];

// The marks site-runtime's `timedRender` gives the Renderer: every loader writes into the page's one Server-Timing header.
export const timingsContext = createContext<{ timings?: Timings }>({});

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
