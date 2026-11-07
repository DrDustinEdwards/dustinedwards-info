import { createContext, type RouterContextProvider } from "react-router";

import {
  cloudflareContext,
  cspNonceContext,
  getEnv,
  getExecutionContext,
  getNonce,
} from "@dustinedwards/site-runtime/context";

import type { previewBlogPost } from "~/db/posts";

// The request context, the admin render's CSP nonce (public pages are edge-cached and carry none, workers/csp.mjs) and
// their readers are site-runtime's ./context, re-exported so routes keep one import.
export { cloudflareContext, cspNonceContext, getEnv, getExecutionContext, getNonce };

/**
 * The Renderer's own document handler, so the Carrel preview renders a page in-process through the
 * site's routes and root layout. In-process, not a fetch to the Renderer: that entrypoint's response
 * is the one the edge stores, and a preview must never be stored.
 */
// A null default, not undefined: React Router treats an undefined default as none, and a get of an
// unset context then throws, which would fail every request that never sets it.
export const documentHandlerContext = createContext<
  ((request: Request, context: RouterContextProvider) => Promise<Response>) | null
>(null);

/**
 * Set only for a Carrel preview render: the post row built from submitted source, which the blog
 * route renders in place of the stored row for that slug. Never set on a request from outside.
 */
export const postPreviewContext = createContext<Awaited<ReturnType<typeof previewBlogPost>> | null>(
  null,
);
