import { isRouteErrorResponse, useLocation } from "react-router";
import { ErrorPage } from "capsomer/react/error-page";

import { NotFoundHelp } from "~/components/not-found-help";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { AD_SCENE, UtilityAd } from "~/components/utility-ad";
import { pickAd } from "~/utility-ads/registry";

/**
 * Capsomer's error page (capsomer/react/error-page) with this site's frame, for root.tsx's and the public layout's
 * ErrorBoundary. SiteHeader and ShellFooter read no loader data, so nothing is missing on the error path. A 404 keeps
 * the site's own help under the message: the site search started from the missing address, and the sections.
 *
 * Behind the message sits one vintage comic-book ad, picked at random on the server for each request
 * (docs/UTILITY-ADS.md). It is this site's theme slot on Capsomer's page: the message, the buttons and the help are
 * Capsomer's and the site's, in the same place whichever ad is served, and the ad is hidden decoration after them.
 * `?ad=<id>` names one, for a link to it. The pages that render this do not hydrate, so the server's pick is the page's.
 */
export function SiteErrorPage({ error }: { error: unknown }) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const { search } = useLocation();
  const ad = pickAd(search);
  return (
    <ErrorPage
      error={error}
      home="/"
      siteHeader={<SiteHeader />}
      siteFooter={<ShellFooter />}
      dev={import.meta.env.DEV}
      className={ad ? AD_SCENE : undefined}
    >
      {notFound ? <NotFoundHelp /> : null}
      {ad ? <UtilityAd ad={ad} /> : null}
    </ErrorPage>
  );
}
