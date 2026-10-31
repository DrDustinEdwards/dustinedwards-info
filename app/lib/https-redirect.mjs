/*
 * The plaintext redirect itself is site-runtime's `canonicalRedirect` (workers/app.ts). A gateway redirect must never
 * be cached: the scheme is not in the edge key, so HTTPS readers would be redirected to the URL they asked for.
 */

/**
 * 308 for non-GET: a 301 lets a browser turn a POST into a GET and drop the
 * no-script sign-in form's body. Every redirect the gateway answers uses this rule; the post and
 * PDF helpers re-export it under their own names.
 *
 * @param {string} method
 * @returns {number}
 */
export function httpsRedirectStatus(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "GET" || m === "HEAD" ? 301 : 308;
}
