import { LAB_BENCH_PATH } from "capsomer/behavior/family-footer";

// Separate from app.ts so the worker tests can call it on both branches.

import { TRUSTED_TYPES_NAMES } from "@dustinedwards/site-runtime/trusted-types";
import { PODCAST_AUDIO_HOSTS } from "../app/lib/podcast/feed.mjs";

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
export function isMediaPath(pathname) {
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
 * What this site loads, the one list site-runtime's pageSecurity builds the policy from (workers/security-headers.mjs).
 * Every render gets a nonce (site-runtime ./worker), and a stored public page has it renewed per reader (`renew`), so no
 * two readers share one. Public pages run no inline script at all: /site.js and the islands it imports are same-origin, so
 * 'self' covers them, and the prefetch rules come from a same-origin file the response header names (site-runtime
 * ./prefetch), which needs no allowance. The private planes are `private, no-store` and rendered for their reader alone.
 * A /media path keeps the UPLOAD_HEADERS policy its response carries (workers/app.ts), which the package leaves alone.
 * No 'strict-dynamic': browsers ignore every host
 * source while it is present, so an approved file could never run; 'self' covers /site.js and the islands. The
 * admin plane's nonce also covers CodeMirror's inline <style>, which cannot be turned off. Nonces do not apply to style
 * attributes, and Shiki emits about 117 inline style="" per post, so those are allowed as attributes only.
 *
 * @param {{ nonce: string | undefined }} context
 */
export function pagePolicy({ nonce }) {
  return {
    sources: { img: ["data:"], media: PODCAST_AUDIO_HOSTS.map((host) => `https://${host}`) },
    nonce: nonce || undefined,
    styleAttributesInline: true,
    cloudflareWebAnalytics: true,
    // The post players (YouTube, Spotify and the rest of Dustin's list) a post may embed; the registry entry's `embeds`
    // opt-in delegates their features in the Permissions-Policy.
    embeds: true,
    // Trusted Types is enforced: every sink takes a policy's value (site-runtime ./trusted-types, installed by startPage).
    trustedTypes: TRUSTED_TYPES_NAMES,
  };
}
