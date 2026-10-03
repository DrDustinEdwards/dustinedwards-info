import { Outlet, isRouteErrorResponse } from "react-router";

import { NotFoundHelp } from "~/components/not-found-help";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";

import type { Route } from "./+types/legacy-public";

/*
 * TEMPORARY, and the ONE place the old public design's global CSS is loaded. The admin is Capsomer's and
 * loads none of it (an unlayered reset would override Capsomer's layered rules), so every route outside
 * /admin and /api nests under this layout. When the public site is rebuilt on Capsomer, delete this file,
 * its `layout(...)` wrapper in routes.ts, routes/not-found.tsx's reason to exist, and the old sheets it
 * imports; nothing in the admin reads any of them.
 */
import "~/app.css";

// Module imports, not @import in app.css, which CSS drops after any rule.
// The order is the cascade: do not sort.
import "~/styles/public-chrome.css";
import "~/styles/page-shell.css";
import "~/styles/chrome-nav.css";
import "~/styles/skip-link.css";
import "~/styles/motion-print.css";
import "~/styles/search-trigger.css";
// Last: shell.css must win where it and page-shell.css touch the same thing.
import "~/styles/shell.css";

export default function PublicLayout() {
  return <Outlet />;
}

/*
 * The public pages' error page, here and not only in root.tsx: React Router links the stylesheets of the routes
 * down to the boundary that renders, so a boundary in root.tsx would show a public error page with none of the
 * old public CSS. Same markup as root's, which keeps the last-resort copy for an error above this layout.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
          <h1>{message}</h1>
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
