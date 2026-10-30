import { isRouteErrorResponse } from "react-router";
import { ErrorPage } from "capsomer/react/error-page";

import { NotFoundHelp } from "~/components/not-found-help";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";

/**
 * Capsomer's error page (capsomer/react/error-page) with this site's frame, for root.tsx's and the public layout's
 * ErrorBoundary. SiteHeader and ShellFooter read no loader data, so nothing is missing on the error path. A 404 keeps
 * the site's own help under the message: the site search started from the missing address, and the sections.
 */
export function SiteErrorPage({ error }: { error: unknown }) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <ErrorPage error={error} home="/" siteHeader={<SiteHeader />} siteFooter={<ShellFooter />} dev={import.meta.env.DEV}>
      {notFound ? <NotFoundHelp /> : null}
    </ErrorPage>
  );
}
