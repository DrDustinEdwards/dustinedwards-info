// The security headers this site sends: the shared package's standard (the OWASP Secure Headers Project's own values) with
// this site's deviations, each beside the reason for it. In its own module, not in app.ts, so the gate (check:headers) and
// verify-live import the set instead of parsing source for it, and so the list of deviations is the one place to read what
// this site does differently from the standard and why.

import { buildSecurityHeaders } from "../packages/security-headers/headers.mjs";

/**
 * Looks tightenable and is not. Each entry is a header this site sends differently from OSHP's recommendation; a header
 * not listed here is OSHP's value exactly. Dustin ratified these values (the gate's RATIFIED set holds them), and none is
 * changed by the package: CORP `same-origin` would break off-site og:image previews; COOP is left loose so cross-origin
 * popups and redirects keep working; HSTS carries `includeSubDomains` (we own the apex, and every subdomain serves valid
 * HTTPS, checked 2026-10-03) and never `preload`, a one-way door (CUTOVER.md 3.10). Never deny `clipboard-write`: the copy
 * controls swallow the refusal silently.
 *
 * @type {Readonly<Record<string, import("../packages/security-headers/headers.mjs").HeaderOverride>>}
 */
export const SITE_HEADER_OVERRIDES = Object.freeze({
  "Strict-Transport-Security": {
    value: "max-age=31536000; includeSubDomains",
    reason: "One year with includeSubDomains is the ratified value, and preload is never sent (a one-way door, CUTOVER.md 3.10). OSHP's two years has not been ruled on for this site.",
  },
  "Referrer-Policy": {
    value: "strict-origin-when-cross-origin",
    reason: "The ratified value for this site. OSHP recommends no-referrer, which is stricter and has not been ruled on for this site.",
  },
  // One string literal, never a concatenation.
  "Permissions-Policy": {
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
    reason: "clipboard-write must stay allowed: the copy controls swallow the refusal silently. OSHP's longer list denies it, and has not been ruled on feature by feature for this site.",
  },
  "Cross-Origin-Opener-Policy": {
    value: "same-origin-allow-popups",
    reason: "Plain same-origin would sever the opener of any cross-origin popup a sign-in or embed opens; allow-popups keeps that working and is the ratified value.",
  },
  "Cross-Origin-Resource-Policy": {
    value: "cross-origin",
    reason: "same-origin would block social platforms fetching og:image from /media/og/*; the failure is off-site, silent and invisible from this repo.",
  },
});

/** The set this site sends: the standard and the deviations above. */
export const SECURITY_HEADERS = Object.freeze(buildSecurityHeaders({ overrides: SITE_HEADER_OVERRIDES }));
