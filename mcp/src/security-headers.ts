/**
 * Every security header this Worker sends, and the one place they are applied. The entry
 * (index.ts) passes every response through `withSecurityHeaders`: /mcp, the OAuth library's
 * endpoints and redirects, the consent page, /callback, /register, /probe, /health, errors and
 * 404s. No other file sets a security header.
 *
 * The set is the portfolio's shared one (`@dustinedwards/site-runtime`, the OWASP Secure Headers
 * Project's values), as the site Worker sends it (workers/security-headers.mjs) and as Capsid's MCP
 * Worker does for non-HTML (capsid src/headers.ts). What this Worker sends differently is listed
 * below beside its reason, and nothing else is typed here.
 */

import { applyHeaderSet, buildSecurityHeaders, type HeaderOverride } from "@dustinedwards/site-runtime/headers";
import { buildPolicy, scriptHash } from "@dustinedwards/site-runtime/csp";
import { CONSENT_STYLE } from "@dustinedwards/site-runtime/mcp-login";

/**
 * Where browsers send CSP violations: this Worker's own sink (csp-report.ts), so a blocked
 * consent page is heard about here rather than on another Worker.
 */
export const CSP_REPORT_PATH = "/csp-report";
const CSP_ENDPOINT_NAME = "csp-endpoint";

/**
 * Each entry is a header sent differently from the standard; a header not listed is OSHP's value.
 */
const MCP_HEADER_OVERRIDES: Readonly<Record<string, HeaderOverride>> = Object.freeze({
  "Cross-Origin-Opener-Policy": {
    value: null,
    reason:
      "The OAuth sign-in runs in a window a client such as claude.ai opens. COOP same-origin on /authorize would " +
      "sever that window from its opener, so the client could no longer see the flow finish (Capsid removes it for the same reason).",
  },
});

/** The set every response carries: the standard and the deviations above. */
export const securityHeaders: Readonly<Record<string, string>> = Object.freeze(
  buildSecurityHeaders({ overrides: MCP_HEADER_OVERRIDES }),
);

/**
 * Everything that is not the consent page: JSON-RPC and its event stream, the OAuth library's
 * JSON, plain-text errors, redirects. None of it is a page, so it may load nothing at all.
 */
export const NON_HTML_CSP = buildPolicy([
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_ENDPOINT_NAME}`,
]);

/**
 * The consent page (login-handler.ts): one inline <style>, trusted by its hash, and a form that
 * posts back to /authorize. No script, image or font.
 *
 * Not buildContentSecurityPolicy, because that builder always writes `form-action 'self'`, and
 * this form must not have one. Approving submits into a redirect chain (POST /authorize, 302 to
 * Cloudflare Access, back to /callback, 302 out to the client's redirect_uri), Chrome checks
 * form-action against every hop, and the last hop is whatever redirect_uri a client names, so no
 * fixed list is right. Capsid shipped `form-action 'self'` once and it silently broke sign-in for
 * 26 days (capsid src/headers.ts, CONSENT_DIALOG_HEADERS).
 */
let consentPolicy: Promise<string> | undefined;
export function consentPageCsp(): Promise<string> {
  consentPolicy ??= scriptHash(CONSENT_STYLE).then((hash) =>
    buildPolicy([
      "default-src 'none'",
      `style-src '${hash}'`,
      "base-uri 'none'",
      "frame-ancestors 'none'",
      `report-uri ${CSP_REPORT_PATH}`,
      `report-to ${CSP_ENDPOINT_NAME}`,
    ]),
  );
  return consentPolicy;
}

/**
 * The response with the set and the policy for its type. Headers on a library's Response can be
 * immutable (Response.redirect), so it is always rebuilt; the body stream passes through
 * untouched, which keeps the MCP event stream streaming. A WebSocket upgrade (status 101) cannot
 * be rebuilt and carries no document, so it is returned as it is. `origin` is the request's, for
 * the report address.
 */
export async function withSecurityHeaders(response: Response, origin: string): Promise<Response> {
  if (response.status === 101 || (response as Response & { webSocket?: unknown }).webSocket) return response;
  const headers = new Headers(response.headers);
  applyHeaderSet(headers, securityHeaders);
  const isHtml = (headers.get("content-type") ?? "").toLowerCase().includes("text/html");
  headers.set("Content-Security-Policy", isHtml ? await consentPageCsp() : NON_HTML_CSP);
  // Absolute, because Reporting-Endpoints ignores a relative endpoint (as in Carrel and the site).
  headers.set("Reporting-Endpoints", `${CSP_ENDPOINT_NAME}="${origin}${CSP_REPORT_PATH}"`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
