import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";

import { getNonce } from "~/lib/context";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // The request context `workers/app.ts` built and set `nonceContext` into.
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;

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
          console.error(error);
        }
      },
    },
  );
  shellRendered = true;

  // No `await body.allReady` for crawlers: the only Suspense boundary is on the admin plane. If a
  // public route ever streams one, restore the wait, not a user-agent sniff.

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
