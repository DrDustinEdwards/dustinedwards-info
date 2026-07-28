import { createContext, type RouterContextProvider } from "react-router";

/**
 * Carries the Cloudflare bindings through the React Router request context.
 * The Worker entry sets this; loaders and actions read it via getEnv(context).
 */
export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}

/**
 * The Worker's ExecutionContext, for `waitUntil`.
 *
 * Used by the Ask cache to finish writing an answer after the response has
 * already been streamed to the reader, so caching costs the reader nothing.
 * Same principle as the KV citation cache: never make a reader wait for
 * bookkeeping.
 */
export function getExecutionContext(
  context: Readonly<RouterContextProvider>,
): ExecutionContext {
  return context.get(cloudflareContext).ctx;
}
