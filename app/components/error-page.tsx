import { isRouteErrorResponse, useLocation } from "react-router";
import { ErrorPage } from "capsomer/react/error-page";

import { NotFoundHelp } from "~/components/not-found-help";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { UtilityAd } from "~/components/utility-ad";
import { pickAd } from "~/utility-ads/registry";

/**
 * Capsomer's error page (capsomer/react/error-page) with this site's frame, for root.tsx's and the public layout's
 * ErrorBoundary. SiteHeader and ShellFooter read no loader data, so nothing is missing on the error path. A 404 keeps
 * the site's own help under the message: the site search started from the missing address, and the sections.
 *
 * At the foot, bottom right, sits one small vintage comic-book ad, picked at random on the server for each request
 * (docs/UTILITY-ADS.md). It is this site's theme slot on Capsomer's page: the page above it is unchanged, with the same
 * background, and the ad is hidden decoration after the message, the buttons and the help.
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
    >
      {notFound ? <NotFoundHelp /> : null}
      {ad ? <UtilityAd ad={ad} /> : null}
    </ErrorPage>
  );
}
