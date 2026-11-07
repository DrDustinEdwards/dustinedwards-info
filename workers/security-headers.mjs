// The security headers this site sends, once, through site-runtime's pageSecurity. The static files' `_headers` is written
// from the same registry entry by site-runtime's bin (npm run build:headers), with the same TDMRep header.

import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";
import { pageSecurity } from "@dustinedwards/site-runtime/page-headers";
import { dustinedwardsInfo } from "@dustinedwards/site-runtime/sites";
import { pagePolicy } from "./csp.mjs";
import { isUnpolicedType } from "./feed-types.mjs";

/** The set this site sends: its registry entry (site-runtime ./sites) and Prelum's TDMRep header reserving training rights as /ai.txt says.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SECURITY_HEADERS = Object.freeze({
  ...buildSecurityHeaders({ site: dustinedwardsInfo }),
  ...TDM_RESERVATION_HEADERS,
});

/**
 * Pages are stored at the edge (`renew`), so a stored page that carries a nonce gets a fresh one per reader. The
 * Report-Only companion stages Trusted Types and default-src 'none' until the reports are quiet. An image or a feed may be
 * embedded by another origin (`corp`).
 */
export const { withSecurityHeaders, nonceFor } = pageSecurity({
  set: SECURITY_HEADERS,
  policy: pagePolicy,
  staged: { trustedTypes: true, denyUnlisted: true },
  corp: true,
  renew: true,
  unpoliced: isUnpolicedType,
});
