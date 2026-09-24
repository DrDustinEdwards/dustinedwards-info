import { createContext, type RouterContextProvider } from "react-router";

export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}

// Unlike the other response headers, the nonce must exist before the render: the same value goes
// in the CSP header and on every `<script>` in the body.
export const nonceContext = createContext<string>();

export function getNonce(context: Readonly<RouterContextProvider>): string {
  return context.get(nonceContext);
}

export function getExecutionContext(
  context: Readonly<RouterContextProvider>,
): ExecutionContext {
  return context.get(cloudflareContext).ctx;
}
