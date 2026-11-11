import { ErrorAd } from "capsomer/react/error-ad";

import type { ADS } from "~/utility-ads/registry";
// `?url`, not imports of the sheet itself: the root error boundary renders this, and a module import there would put the
// ad's sheet and fonts on every page of the site.
import adCssUrl from "capsomer/error-ad.css?url";
import bangersUrl from "capsomer/fonts/bangers-latin-400-normal.woff2?url";
import alfaUrl from "capsomer/fonts/alfa-slab-one-latin-400-normal.woff2?url";

/**
 * One ad as decoration at the foot of a utility page: Capsomer's error ad, with the site's own ads (app/utility-ads)
 * and this build's addresses for the sheet and the two fonts. Put it last in main.
 */
export function UtilityAd({
  ad,
  size = "corner",
}: {
  ad: (typeof ADS)[number];
  size?: "corner" | "large";
}) {
  return <ErrorAd ad={ad} size={size} stylesheet={adCssUrl} fonts={[bangersUrl, alfaUrl]} />;
}
