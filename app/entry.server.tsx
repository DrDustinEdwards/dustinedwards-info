import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";

import { getNonce } from "~/lib/context";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // The FIFTH argument is the request context `workers/app.ts` built, the same
  // object it set `nonceContext` into. The default entry shipped by
  // `@react-router/dev` names it `_loadContext` for exactly this reason.
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;

  /*
   * THE NONCE PROP, AND WHY ITS ABSENCE WAS A REAL BUG.
   *
   * `ServerRouter` puts the value into `FrameworkContext`, which is the fallback
   * `<Scripts>` reads, AND passes it to `StreamTransfer`, which stamps it on both of
   * React Router's streaming scripts. Without it those ship bare on EVERY page, and
   * under an enforcing CSP the `enqueue` script carries the hydration payload, so
   * the site would render and never hydrate.
   *
   * THE PROP IS NOT ENOUGH. REACT EMITS INLINE SCRIPTS OF ITS OWN, AND ONLY THE
   * RENDER OPTION BELOW STAMPS THOSE. The prop reaches react-router's components; it
   * cannot reach react-dom, which writes its own inline scripts to COMPLETE a
   * Suspense boundary and takes their nonce from `renderToReadableStream`'s OPTIONS.
   * `test/ssr-nonce.test.mjs` holds that pair, including the no-option control, so
   * the option cannot be dropped without a named failure.
   */
  const nonce = getNonce(loadContext);

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    {
      // For react-dom's OWN streaming scripts. See the block above; the prop on
      // ServerRouter does not reach them and an enforcing CSP blocks them.
      nonce,
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
        }
      },
    },
  );
  shellRendered = true;

  /*
   * NO `await body.allReady`, AND NO USER-AGENT SNIFF. The template waits for the
   * whole tree when the caller looks like a crawler, which is worth doing on a site
   * that streams a boundary. This one does not: the repository declares exactly ONE
   * Suspense boundary, on the ADMIN plane behind a session, where no crawler
   * arrives.
   *
   * So the branch could never fire for a reader, and `isbot` went with it: a
   * dependency the deployed Worker carries for a branch that cannot be taken is a
   * dependency lying about what serves the site.
   *
   * IF A PUBLIC ROUTE EVER STREAMS A BOUNDARY, THIS DECISION IS REVERSED, and the
   * thing to restore is the wait, not the sniff.
   */

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
