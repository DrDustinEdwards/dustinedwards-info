/**
 * The CSP violation sink the policies in security-headers.ts name: the family's one receiver
 * (@dustinedwards/site-runtime/csp-report), the same one the site's /api/csp-report uses. A public,
 * unauthenticated POST (browsers send reports without credentials) that logs trimmed lines and
 * stores nothing. It reaches no binding but the rate limiter and nothing on the operator API, so it
 * is no second route to the app. The security set is put on by withSecurityHeaders in index.ts.
 *
 * Always 204 to a browser's POST, even when limited, too large or unreadable: an error status makes
 * browsers send the report again. Anything but POST and OPTIONS is 405.
 */

import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { checkRateLimit } from "@dustinedwards/site-runtime/mcp-server";

import type { RateLimitEnv } from "./index";

/** Loose, because a page tripping ten rules sends ten reports. */
const REPORTS_PER_MINUTE = 60;

export function handleCspReport(request: Request, env: Partial<RateLimitEnv>): Promise<Response> {
  return receiveCspReport(request, {
    allow: async (r) => {
      const ip = r.headers.get("cf-connecting-ip") ?? "unknown";
      return (await checkRateLimit(env.OPERATOR_RATE_LIMIT, `csp:${ip}`, REPORTS_PER_MINUTE)).allowed;
    },
  });
}
