// Separate from app.ts so the worker tests can call it on both branches.

import { PODCAST_AUDIO_HOSTS } from "../app/lib/podcast/feed.mjs";
import { CLOUDFLARE_WEB_ANALYTICS, buildContentSecurityPolicy, buildPolicy } from "@dustinedwards/site-runtime/csp";

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
function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * The /lab workspace (docs/KNOWLEDGE-BASE.md step 5): lab members signed in through their own Access application.
 * Exact-or-slash like the admin plane, so the public `/research/lab` and a future `/laboratory` stay public.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function isLabPath(pathname) {
  return pathname === "/lab" || pathname.startsWith("/lab/");
}

/**
 * The signed-in planes, /admin and /lab: every response there is `private, no-store`, so each render gets its own
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
 * name the file, say what it is for and what it sends, and the privacy page changes in the same
 * commit. Dustin approves the line; a session does not add one on its own.
 *
 * Injected by Cloudflare's edge, not rendered by this code, so it carries no nonce and no hash, and
 * its `integrity` value changes whenever Cloudflare ships a new beacon, so pinning that hash here would
 * silently block it within weeks. That is why the policy names the file instead. It reports to this
 * site's own /cdn-cgi/rum, which `connect-src 'self'` already allows.
 */
// Cloudflare Web Analytics, automatic setup, written once in the shared package (CLOUDFLARE_WEB_ANALYTICS): the file URL and
// its versioned path prefix. The policy below asks the package for it by name.
export const APPROVED_SCRIPTS = CLOUDFLARE_WEB_ANALYTICS.script;

/**
 * Public pages get no nonce: header and body are edge-cached together, so a nonce there would be
 * one value shared by every reader for the cache lifetime. They run no inline script at all: /site.js
 * and the islands it imports are same-origin, so 'self' covers them, and the prefetch rules come from
 * a same-origin file the response header names (site-runtime ./prefetch), which needs no allowance.
 * The admin plane is `private, no-store`, so its per-request nonce is sound, and it keeps it for
 * <Scripts>, the sidebar script and CodeMirror's inline <style>. A /media path gets MEDIA_CSP instead,
 * chosen here so the Renderer keeps one place that sets the header.
 *
 * @param {string} pathname the request URL's pathname
 * @param {string | undefined} adminNonce this render's nonce on a private path (/admin, /lab), else undefined
 * @returns {string}
 */
export function contentSecurityPolicy(pathname, adminNonce) {
  if (isMediaPath(pathname)) return MEDIA_CSP;
  // What this site loads, the one list the package builds the policy from. No 'strict-dynamic': browsers ignore every host
  // source while it is present, so an approved file could never run; 'self' covers /site.js and the islands. The
  // admin plane's nonce also covers CodeMirror's inline <style>, which cannot be turned off. Nonces do not apply to style
  // attributes, and Shiki emits about 117 inline style="" per post, so those are allowed as attributes only.
  return buildContentSecurityPolicy({
    sources: { img: ["data:"], media: PODCAST_AUDIO_HOSTS.map((host) => `https://${host}`) },
    nonce: adminNonce || undefined,
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    reportUri: CSP_REPORT_PATH,
    reportTo: CSP_ENDPOINT_NAME,
  }).value;
}
