import { isRouteErrorResponse } from "react-router";

import { NotFoundHelp } from "~/components/not-found-help";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";

/** The error page root.tsx and the public layout each render as their ErrorBoundary. */
export function ErrorPage({ error }: { error: unknown }) {
  let message = "Something broke.";
  let details = "The page failed to render.";
  let stack: string | undefined;
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  if (isRouteErrorResponse(error)) {
    message = notFound ? "404" : "Error";
    details = notFound ? "This page is not here." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  // SiteHeader is safe here: it reads no loader data, so nothing is missing on the error path.
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          <h1 className="page-title cap-layout-grid">{message}</h1>
          <p className="muted">{details}</p>
          {notFound ? <NotFoundHelp /> : null}
          {stack && (
            <pre className="error-stack">
              <code>{stack}</code>
            </pre>
          )}
        </div>
      </main>
      <ShellFooter />
    </>
  );
}
