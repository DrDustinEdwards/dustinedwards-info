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
 * The per-request CSP nonce.
 *
 * **This is the one piece of response policy that is NOT an exit-path mutation.** `UNCACHED` and
 * `SECURITY_HEADERS` in `workers/app.ts` are stamped onto a finished response and need to know
 * nothing about the render. A nonce cannot work that way: the same value has to appear in the
 * `Content-Security-Policy` header AND on every `<script>` in the body, so it must exist BEFORE the
 * render and be readable from inside it.
 *
 * A separate context rather than a field on `cloudflareContext`, because the nonce is not a binding
 * and every existing `getEnv` call site would otherwise have to learn about it.
 */
export const nonceContext = createContext<string>();

/** The nonce for this request. Empty string if nothing set one. */
export function getNonce(context: Readonly<RouterContextProvider>): string {
  return context.get(nonceContext);
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
