// Separate from app.ts so the gate can call it on both branches and assert the strings it returns.

import { ENHANCE_LOADER } from "../app/lib/enhance-loader.mjs";
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

/** @type {Promise<string> | undefined} */
let loaderHash;

/**
 * The hash source for the one inline script every page runs, derived from the constant the page
 * renders, so the two cannot drift. Web Crypto rather than node:crypto, so the Worker and the gates
 * run one function; computed on first use, once per isolate.
 *
 * @returns {Promise<string>} `sha256-<base64>`, without the quotes the policy puts round it
 */
export function enhanceLoaderHash() {
  loaderHash ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(ENHANCE_LOADER))
    .then((digest) => `sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`);
  return loaderHash;
}

/**
 * Public pages get no nonce: header and body are edge-cached together, so a nonce there would be
 * one value shared by every reader for the cache lifetime. They are trusted by the loader's hash
 * instead, and the bundles it inserts by 'strict-dynamic'. The admin plane is `private, no-store`,
 * so its per-request nonce is sound, and it keeps it for <Scripts>, the sidebar script and
 * CodeMirror's inline <style>. The hash is on both, because the loader renders on every page.
 *
 * @param {string | undefined} adminNonce this render's nonce on an admin path, else undefined
 * @returns {Promise<string>}
 */
export async function contentSecurityPolicy(adminNonce) {
  const hash = await enhanceLoaderHash();
  const nonce = adminNonce ? ` 'nonce-${adminNonce}'` : "";
  return [
    "default-src 'self'",
    // 'inline-speculation-rules' admits the header's speculationrules block, whose rules vary by
    // page and so have no build-time hash. It admits no executable script.
    `script-src${nonce} '${hash}' 'strict-dynamic' 'inline-speculation-rules'`,
    // Admin only: CodeMirror mounts an inline <style> that needs a nonce source, and it cannot be
    // turned off.
    `style-src 'self'${nonce}`,
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
