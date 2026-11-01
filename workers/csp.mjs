import { LAB_BENCH_PATH } from "../app/lab/path.mjs";

// Separate from app.ts so the worker tests can call it on both branches.

import { PODCAST_AUDIO_HOSTS } from "../app/lib/podcast/feed.mjs";
import { buildContentSecurityPolicy, buildStagedPolicy } from "@dustinedwards/site-runtime/csp";
import { UPLOAD_HEADERS } from "@dustinedwards/site-runtime/headers";

export { CSP_REPORT_GROUP, CSP_REPORT_PATH } from "@dustinedwards/site-runtime/csp";

/**
 * Exact-or-slash, not a bare prefix, so a future `/administrator` route cannot pick up the admin
 * policy. Keyed on the path because this layer knows nothing of the session; an anonymous 302 or
 * `.data` response that gets the admin nonce is bodiless or JSON, and `private, no-store`.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * The /lab-bench workspace (docs/KNOWLEDGE-BASE.md step 5): lab members signed in through their own Access application.
 * Exact-or-slash like the admin plane, so the public `/research/lab` and a future `/laboratory` stay public.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function isLabPath(pathname) {
  return pathname === LAB_BENCH_PATH || pathname.startsWith(`${LAB_BENCH_PATH}/`);
}

/**
 * The signed-in planes, /admin and /lab-bench: every response there is `private, no-store`, so each render gets its own
 * nonce and is never edge-cached or themed into a shared key.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPrivatePath(pathname) {
  return isAdminPath(pathname) || isLabPath(pathname);
}

/**
 * The media route is exact-or-slash for the same reason as the admin plane: a future `/mediakit`
 * page must keep the document policy.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function isMediaPath(pathname) {
  return pathname === "/media" || pathname.startsWith("/media/");
}

/*
 * THE ONLY THIRD-PARTY SCRIPTS THE SITE RUNS, each an exact file URL and not a host, so nothing else
 * on that host is trusted. A script that makes the site better can be added here deliberately:
 * name the file, say what it is for and what it sends, and the privacy page changes in the same
 * commit. Dustin approves the line; a session does not add one on its own.
 *
 * Injected by Cloudflare's edge, not rendered by this code, so it carries no nonce and no hash, and
 * its `integrity` value changes whenever Cloudflare ships a new beacon, so pinning that hash here would
 * silently block it within weeks. That is why the policy names the file instead. It reports to this
 * site's own /cdn-cgi/rum, which `connect-src 'self'` already allows.
 */
// Today that is Cloudflare Web Analytics, automatic setup: its file URL and versioned path prefix are written once in
// site-runtime (CLOUDFLARE_WEB_ANALYTICS), and the policy below asks the package for it by name.

/**
 * Public pages get no nonce: header and body are edge-cached together, so a nonce there would be
 * one value shared by every reader for the cache lifetime. They run no inline script at all: /site.js
 * and the islands it imports are same-origin, so 'self' covers them, and the prefetch rules come from
 * a same-origin file the response header names (site-runtime ./prefetch), which needs no allowance.
 * The admin plane is `private, no-store`, so its per-request nonce is sound, and it keeps it for
 * <Scripts>, the sidebar script and CodeMirror's inline <style>. A /media path gets UPLOAD_HEADERS' policy instead,
 * chosen here so the Renderer keeps one place that sets the header.
 *
 * @param {string} pathname the request URL's pathname
 * @param {string | undefined} adminNonce this render's nonce on a private path (/admin, /lab-bench), else undefined
 * @returns {string}
 */
export function contentSecurityPolicy(pathname, adminNonce) {
  // Every /media response, whatever its type: stored bytes are never a page of this site, so they get UPLOAD_HEADERS'
  // sandboxed default-src 'none', which stops an SVG or an HTML body from running as the site. TRAP: `sandbox` breaks
  // Chrome's built-in PDF viewer; no PDF is served from /media, and one must never be.
  if (isMediaPath(pathname)) return /** @type {string} */ (UPLOAD_HEADERS["Content-Security-Policy"]);
  return buildContentSecurityPolicy(pagePolicy(adminNonce)).value;
}

/**
 * What the site's registry entry stages (Trusted Types and default-src 'none'), sent as
 * Content-Security-Policy-Report-Only beside the enforced policy until the reports are quiet. A /media
 * file has none: its policy is already default-src 'none' and runs no script.
 *
 * @param {string} pathname the request URL's pathname
 * @param {string | undefined} adminNonce this render's nonce on a private path (/admin, /lab-bench), else undefined
 * @returns {string | undefined}
 */
export function stagedPolicy(pathname, adminNonce) {
  if (isMediaPath(pathname)) return undefined;
  return buildStagedPolicy(pagePolicy(adminNonce), { trustedTypes: true, denyUnlisted: true }).value;
}

/**
 * What this site loads, the one list the package builds the policy from. No 'strict-dynamic': browsers ignore every host
 * source while it is present, so an approved file could never run; 'self' covers /site.js and the islands. The
 * admin plane's nonce also covers CodeMirror's inline <style>, which cannot be turned off. Nonces do not apply to style
 * attributes, and Shiki emits about 117 inline style="" per post, so those are allowed as attributes only.
 *
 * @param {string | undefined} adminNonce
 */
function pagePolicy(adminNonce) {
  return {
    sources: { img: ["data:"], media: PODCAST_AUDIO_HOSTS.map((host) => `https://${host}`) },
    nonce: adminNonce || undefined,
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    // The post players (YouTube, Spotify and the rest of Dustin's list) a post may embed; the registry entry's `embeds`
    // opt-in delegates their features in the Permissions-Policy.
    embeds: true,
  };
}
