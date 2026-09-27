/**
 * The standard response header set every site in the portfolio sends, and one way to apply a set.
 *
 * Drawn from two sites that solved this separately (capsid/research/design-shared-functions.md, point 5):
 * - dustinedwards.info's workers/app.ts: HSTS, nosniff, Referrer-Policy, X-Frame-Options, a
 *   Permissions-Policy, and the set applied on every exit of the Worker.
 * - foxhound's app/lib/http/security-headers.ts: the same five, and applying them onto a response
 *   without overwriting what a route already set.
 *
 * The standard is the part both agree on. A site adds its own on top (dustinedwards.info adds
 * Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy and more denied features); check.mjs holds a
 * site's set to this floor, never to its extras.
 */

/**
 * No `includeSubDomains` or `preload`: a site on a shared parent domain (workers.dev) cannot claim its
 * parent, and preload is a one-way door. A site that owns its apex adds them itself.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const STANDARD_SECURITY_HEADERS = Object.freeze({
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
});

/**
 * Stamps a header set onto `headers` in place.
 *
 * `overwrite: true` (the default) makes the set authoritative, which is what dustinedwards.info does on
 * every exit. `overwrite: false` keeps any value a route already chose, which is foxhound's merge. A
 * Response whose headers are immutable (Response.redirect, the Cache API) throws on `set`; rebuild it
 * with `new Response(res.body, { ...res, headers: new Headers(res.headers) })` and apply to that.
 *
 * @param {Headers} headers
 * @param {Readonly<Record<string, string>>} [set]
 * @param {{ overwrite?: boolean }} [options]
 */
export function applyHeaderSet(headers, set = STANDARD_SECURITY_HEADERS, { overwrite = true } = {}) {
  for (const [name, value] of Object.entries(set)) {
    if (overwrite || !headers.has(name)) headers.set(name, value);
  }
}
