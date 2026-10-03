// Separate from app.ts so the gate can call it on both branches and assert the strings it returns.

import { ENHANCE_LOADER } from "../app/lib/enhance-loader.mjs";
import { PODCAST_AUDIO_HOSTS } from "../app/lib/podcast/feed.mjs";
import { buildSpeculationRules } from "../app/lib/speculation.mjs";
import { buildPolicy, scriptHash } from "../packages/security-headers/csp.mjs";

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
 * The media route is exact-or-slash for the same reason as the admin plane: a future `/mediakit`
 * page must keep the document policy.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isMediaPath(pathname) {
  return pathname === "/media" || pathname.startsWith("/media/");
}

/**
 * Every /media response, whatever its type: stored bytes are never a page of this site, so they get
 * no script, no connection and a sandbox, which gives an opened file an opaque origin. That is what
 * stops an SVG or an HTML body (a hand-put object, a legacy upload, a wrong content type) from
 * running as the site. `img-src 'self' data:` and `style-src 'unsafe-inline'` are what the browser's
 * own image viewer needs when a reader opens an image directly.
 *
 * TRAP: `sandbox` breaks Chrome's built-in PDF viewer, which refuses to load in a sandboxed
 * document. No PDF is served from /media today; one must be served elsewhere, never through here.
 */
export const MEDIA_CSP = buildPolicy([
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'unsafe-inline'",
  "sandbox",
]);

/**
 * THE ONLY THIRD-PARTY SCRIPTS THE SITE RUNS, each an exact file URL and not a host, so nothing else
 * on that host is trusted. A script that makes the site better can be added here deliberately:
 * name the file, say what it is for and what it sends, and the gate (check:headers) and the privacy
 * page change in the same commit. Dustin approves the line; a session does not add one on its own.
 *
 * Injected by Cloudflare's edge, not rendered by this code, so it carries no nonce and no hash, and
 * its `integrity` value changes whenever Cloudflare ships a new beacon, so pinning that hash here would
 * silently block it within weeks. That is why the policy names the file instead. It reports to this
 * site's own /cdn-cgi/rum, which `connect-src 'self'` already allows.
 */
export const APPROVED_SCRIPTS = Object.freeze([
  // Cloudflare Web Analytics, automatic setup. The edge injects it from a VERSIONED path
  // (/beacon.min.js/v31edd..., measured in a browser 2026-10-03), which the bare file URL does not
  // match; a source ending in "/" is a path prefix, so the second line covers that one directory.
  "https://static.cloudflareinsights.com/beacon.min.js",
  "https://static.cloudflareinsights.com/beacon.min.js/",
]);

/** @type {Promise<string> | undefined} */
let loaderHash;

/**
 * The hash source for the one inline script every page runs, derived from the constant the page
 * renders, so the two cannot drift. Computed on first use, once per isolate.
 *
 * @returns {Promise<string>}
 */
export function enhanceLoaderHash() {
  loaderHash ??= scriptHash(ENHANCE_LOADER);
  return loaderHash;
}

/**
 * The hash source for the page's speculationrules block. Its rules exclude the page itself, so
 * they vary by pathname, and are hashed per response from the same builder SiteSpeculation renders
 * with. Deterministic in the pathname, which is in the cache key, so a cached copy stays correct.
 * 'inline-speculation-rules' does not stand in for this: Chrome and WebKit refuse the block under
 * this policy without a hash.
 *
 * @param {string} pathname the request URL's pathname, which is what `useLocation()` reports
 * @returns {Promise<string>}
 */
export function speculationRulesHash(pathname) {
  return scriptHash(buildSpeculationRules({ pathname }));
}

/**
 * Public pages get no nonce: header and body are edge-cached together, so a nonce there would be
 * one value shared by every reader for the cache lifetime. They are trusted by the loader's hash
 * instead, and the bundles it inserts by 'self'. The admin plane is `private, no-store`,
 * so its per-request nonce is sound, and it keeps it for <Scripts>, the sidebar script and
 * CodeMirror's inline <style>. The hash is on both, because the loader renders on every page.
 * A /media path gets MEDIA_CSP instead, chosen here so the Renderer keeps one place that sets the
 * header.
 *
 * @param {string} pathname the request URL's pathname, for the speculation rules' hash
 * @param {string | undefined} adminNonce this render's nonce on an admin path, else undefined
 * @returns {Promise<string>}
 */
export async function contentSecurityPolicy(pathname, adminNonce) {
  if (isMediaPath(pathname)) return MEDIA_CSP;
  const loader = await enhanceLoaderHash();
  const rules = await speculationRulesHash(pathname);
  const nonce = adminNonce ? ` 'nonce-${adminNonce}'` : "";
  return buildPolicy([
    "default-src 'self'",
    // No 'strict-dynamic': browsers ignore every host source while it is present, so an approved file
    // could never run. 'self' covers the bundles the loader inserts; APPROVED_SCRIPTS is the rest.
    `script-src${nonce} '${loader}' '${rules}' 'self' ${APPROVED_SCRIPTS.join(" ")}`,
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
  ]);
}
