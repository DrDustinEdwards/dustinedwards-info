import { securityTxtResponse } from "@dustinedwards/site-runtime/security-txt";

import { SITE_ORIGIN } from "~/lib/seo";

/**
 * RFC 9116, from site-runtime. Expires is a fixed date, not "a year from now": a file that renews itself on every
 * request would keep vouching for a contact nobody has checked. The family check fails 30 days before it lapses, which
 * is the prompt to confirm the address still works and move it on. Cached for an hour, the helper's default. The admin
 * MCP (mcp/src/index.ts) serves the same contact and date; move both together.
 */
export const SECURITY_CONTACT = "security@dustinedwards.info";
export const SECURITY_TXT_EXPIRES = "2027-09-28T00:00:00.000Z";

export function loader() {
  return securityTxtResponse({ origin: SITE_ORIGIN, contact: SECURITY_CONTACT, expires: SECURITY_TXT_EXPIRES });
}
