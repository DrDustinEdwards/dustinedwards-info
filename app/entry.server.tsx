import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

import { getNonce } from "~/lib/context";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // The FIFTH argument is the request context `workers/app.ts` built, the same
  // object it set `nonceContext` into. `server.js` calls this function as
  // `handleDocumentRequestFunction(request, status, headers, entryContext,
  // loadContext)`, and the default entry shipped by @react-router/dev names it
  // `_loadContext` for exactly this reason.
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  /*
   * THE NONCE PROP, AND WHY ITS ABSENCE WAS A REAL BUG.
   *
   * `ServerRouter` does two things with this prop: it puts the value into
   * `FrameworkContext`, which is the fallback `<Scripts>` reads, AND it passes
   * it straight to `StreamTransfer`, which stamps it on BOTH of React Router's
   * streaming scripts (`streamController.enqueue(...)` and `.close()`).
   *
   * **Without it those two scripts ship bare on EVERY page**, and under an
   * enforcing CSP the `enqueue` script is the one carrying the hydration
   * payload, so the site would render and never hydrate.
   *
   * MEASURED, not inferred. The Report-Only observation window on 2026-08-06
   * produced 10 violation reports, every one `script-src-elem` with
   * `blockedURL: inline`, and the reported line was the document's LAST line on
   * every page, which is where those two scripts sit. `<Scripts nonce>` in
   * root.tsx was already correct and is why the earlier scripts were clean.
   *
   * This is a documented, supported prop, not a workaround: see
   * `ServerRouterProps.nonce` in react-router's types, and PR #15170, "Use the
   * ServerRouter nonce for nonce-aware SSR components when they don't provide
   * their own value so strict CSP pages can load them."
   *
   * **THE PROP IS NOT ENOUGH. REACT EMITS INLINE SCRIPTS OF ITS OWN, AND ONLY
   * THE RENDER OPTION BELOW STAMPS THOSE.**
   *
   * The prop reaches react-router's components. It cannot reach react-dom,
   * which writes its own inline `<script>` blocks to COMPLETE a Suspense
   * boundary whose content resolves after the shell has flushed. Those are the
   * `$RC` instruction scripts, and react-dom takes their nonce from the
   * `renderToReadableStream` OPTIONS, never from a prop on the tree.
   *
   * MEASURED, not inferred: a boundary resolving after the shell emits exactly
   * two inline scripts, `<script id="_R_">` and a bare `<script>`. Without the
   * option both ship with no nonce; with it both carry one. `test/ssr-nonce.test.mjs`
   * holds that pair, including the no-option control, so the option cannot be
   * dropped without a named failure.
   *
   * **This was inert for eleven days and then was not.** The policy spent them
   * in Report-Only, where a blocked script is only a report. Enforcement landed
   * 2026-08-17 and the site's ONE Suspense boundary, the lazily imported
   * CodeMirror in the post editor, stopped completing: the browser refused the
   * two scripts, the boundary never swapped its `null` fallback for the editor,
   * and react reported error #419, "the server could not finish this Suspense
   * boundary". The editor route rendered a plain textarea and nothing said why.
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

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
