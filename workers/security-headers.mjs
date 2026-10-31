// The security headers this site sends. The static files' `_headers` is written from the same registry entry by
// site-runtime's bin (npm run build:headers), with the same TDMRep header.

import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";
import { dustinedwardsInfo } from "@dustinedwards/site-runtime/sites";

/** The set this site sends: its registry entry (site-runtime ./sites) and Prelum's TDMRep header reserving training rights as /ai.txt says.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SECURITY_HEADERS = Object.freeze({
  ...buildSecurityHeaders({ site: dustinedwardsInfo }),
  ...TDM_RESERVATION_HEADERS,
});
