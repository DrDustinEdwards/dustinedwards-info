/*
 * HSTS is ignored over plaintext (RFC 6797 section 7.2), so this redirect is what
 * protects a first visit. It cannot fix a plaintext cache HIT: the edge cache
 * runs before the Worker and the scheme is not in its key ("Always Use HTTPS" at
 * the zone can). For the same reason the redirect must never be cached, or HTTPS
 * readers would be redirected to the URL they asked for: a loop.
 */

/** The dev server and wrangler serve plaintext; redirecting them breaks local dev. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * @param {string} requestUrl
 * @returns {string | null}
 */
export function httpsRedirectTarget(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:") return null;
  if (LOOPBACK.has(url.hostname)) return null;
  if (url.hostname.endsWith(".localhost")) return null;

  url.protocol = "https:";
  return url.toString();
}

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
