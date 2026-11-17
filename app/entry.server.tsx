import type { EntryContext, HandleErrorFunction, RouterContextProvider } from "react-router";
import { createContext, ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";

import { getNonce } from "~/lib/context";
import { isDatabaseDown } from "@dustinedwards/site-runtime/health";
import { errorMessage, handleServerError } from "@dustinedwards/site-runtime/log";

/** Set by handleError when a route failed because D1 was down for a moment; read by handleRequest. */
const databaseDownContext = createContext(false);

// React Router prints every route error, so each scanner 404 wrote a stack trace; a route 404 is counted, not logged.
// handleError sees the error itself; by the time handleRequest runs, React Router has replaced a production route
// error with a bare "Unexpected Server Error", so the database-down reading is taken here.
export const handleError: HandleErrorFunction = (error, args) => {
  if (isDatabaseDown(error)) args.context.set(databaseDownContext, true);
  handleServerError(error, args);
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // The request context site-runtime ./worker built and set `cspNonceContext` into (every render).
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;

  // A loader that failed because D1 was down for a moment (site-runtime isDatabaseDown: overloaded, reset, an import
  // holding the database) answers 503 with Retry-After, not 500, so a crawler or a reader's retry comes back instead
  // of recording a broken page, and no cache keeps the error (MDN, 503 Service Unavailable). The error is still
  // logged by handleError; any other failure keeps its own status.
  if (responseStatusCode >= 500 && loadContext.get(databaseDownContext)) {
    responseStatusCode = 503;
    responseHeaders.set("Retry-After", "60");
    responseHeaders.set("Cache-Control", "no-store");
  }

  // The ServerRouter prop nonces React Router's streaming scripts; without it an enforcing CSP blocks
  // the hydration payload. react-dom's own inline scripts take the nonce only from the render option.
  const nonce = getNonce(loadContext);

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    {
      nonce,
      onError(error: unknown) {
        responseStatusCode = 500;
        // Errors before the shell renders reject and are logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(
            JSON.stringify({ alert: "render-failed-after-shell", detail: errorMessage(error) }),
          );
        }
      },
    },
  );
  shellRendered = true;

  // No `await body.allReady` for crawlers: the only Suspense boundary is on the admin plane. If a
  // public route ever streams one, restore the wait, not a user-agent sniff.

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
