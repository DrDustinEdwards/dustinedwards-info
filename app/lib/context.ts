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
