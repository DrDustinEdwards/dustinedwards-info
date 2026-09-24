// Separate from app.ts so the gate can call it on both branches and assert the strings it returns.

import { PODCAST_AUDIO_HOSTS } from "../app/lib/podcast/feed.mjs";

export const CSP_REPORT_PATH = "/api/csp-report";

export const CSP_ENDPOINT_NAME = "csp-endpoint";

/**
 * Exact-or-slash, not a bare prefix, so a future `/administrator` route cannot pick up the admin
 * policy. Keyed on the path because this layer knows nothing of the session; an anonymous 302 or
 * `.data` response that gets the admin nonce is bodiless or JSON, and `private, no-store`.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * @param {string} nonce
 * @param {boolean} styleNonce
 * @returns {string}
 */
export function contentSecurityPolicy(nonce, styleNonce) {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    // Admin only: CodeMirror mounts an inline <style> that needs a nonce source, and it cannot be
    // turned off. Public pages are edge-cached, so a public nonce would be shared across readers.
    styleNonce ? `style-src 'self' 'nonce-${nonce}'` : "style-src 'self'",
    // Nonces do not apply to style attributes, and Shiki emits about 117 inline style="" per post.
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    `media-src 'self' ${PODCAST_AUDIO_HOSTS.map((host) => `https://${host}`).join(" ")}`,
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_ENDPOINT_NAME}`,
  ].join("; ");
}
