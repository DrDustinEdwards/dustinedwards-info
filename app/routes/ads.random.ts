import { redirect } from "react-router";

import { ADS } from "~/utility-ads/registry";

/** A random ad of the gallery (docs/UTILITY-ADS.md): a 302 to its page, uncached, so each visit can land on another. */
export function loader() {
  return redirect(`/ads/${ADS[Math.floor(Math.random() * ADS.length)]!.id}`);
}
