/**
 * SENDING PLAINTEXT REQUESTS TO HTTPS, AT THE FIRST LINE OF THE WORKER.
 *
 * ## What was measured, 2026-08-23, on the live site
 *
 * Plain `http://` did not redirect. It returned `200` with the full page, and
 * the shared cache did not distinguish the schemes:
 *
 *   https://…/playground  ->  MISS, nonce 0b03047f…
 *   https://…/playground  ->  HIT,  nonce 0b03047f…
 *   http://…/playground   ->  HIT,  nonce 0b03047f…   (first HTTP request)
 *
 * The plaintext response was the byte-identical cached HTTPS response, down to
 * `Reporting-Endpoints` still naming `https://`. `/admin`'s 302 to `/login`
 * also went out in the clear.
 *
 * Three consequences, in order of how much they cost:
 *
 *   1. **The CSP nonce is delivered over plaintext**, and it is the SAME nonce
 *      as the cached HTTPS response. The shared-cache nonce exposure is already
 *      accepted in writing, but it was accepted for readers who FETCH the page.
 *      This widened it to anyone who can observe or inject on the network path,
 *      who can then inject a `<script nonce=…>` the policy will trust.
 *   2. Every public page, and the admin door's redirect, were readable and
 *      tamperable in transit.
 *   3. `Strict-Transport-Security` is sent, but a browser MUST IGNORE HSTS
 *      received over a non-secure transport (RFC 6797 section 7.2), so the
 *      header did not close this on a first visit.
 *
 * ## WHAT THIS FIXES AND WHAT IT DOES NOT, because the difference is the point
 *
 * The Worker runs on plaintext MISSes and on uncacheable paths, which was
 * confirmed by forcing a MISS with a cache-buster and watching the Worker
 * generate an `http://` origin. So this closes `/admin`, `/login`, every
 * `no-store` path, and every cache miss.
 *
 * **IT DOES NOT CLOSE A PLAINTEXT CACHE HIT.** The edge cache is consulted
 * BEFORE the Worker, and the scheme is not part of the key, so a shared-cached
 * public page primed by an HTTPS reader is still served over plaintext until it
 * expires. Workers' automatic cache exposes no cache-key control, so there is
 * no layer inside this Worker that can reach it. The layer that can is
 * "Always Use HTTPS" at the zone, which runs in front of the cache; the site is
 * on workers.dev and pre-cutover, so that is a CUTOVER.md step, not one
 * available today.
 *
 * ## THE REDIRECT MUST NEVER BE CACHED, and that is a safety property
 *
 * Because the scheme is not in the cache key, a cacheable redirect stored under
 * a shared key would be served to HTTPS readers too, redirecting them to the
 * URL they already requested: a loop. `no-store` is not tidiness here, and hard
 * rule 8 says an absent `Cache-Control` is CACHED rather than skipped, so it is
 * stated rather than left to a default.
 *
 * @see test/https-redirect.test.mjs
 */

/**
 * Hosts that must keep working over plaintext: the dev server and wrangler.
 *
 * `npm run dev` serves `http://localhost:5173`. Redirecting that to a port
 * where nothing is listening would break local development for everyone, and
 * it would break it in the one place nobody would look for a security header.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Where this request should be sent instead, or null if it is already fine.
 *
 * @param {string} requestUrl
 * @returns {string | null}
 */
export function httpsRedirectTarget(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    // Nothing to redirect to if the URL cannot be read. Fall through to the
    // router, which is what handled this request before this function existed.
    return null;
  }

  if (url.protocol !== "http:") return null;
  if (LOOPBACK.has(url.hostname)) return null;
  if (url.hostname.endsWith(".localhost")) return null;

  url.protocol = "https:";
  return url.toString();
}

/**
 * 301 for GET and HEAD, 308 for everything else.
 *
 * A 301 lets a client turn a POST into a GET, which is permitted and is what
 * browsers historically did. On this site the only plaintext POST that matters
 * is the no-script sign-in form, and silently dropping its body would leave an
 * operator staring at a door that does nothing. 308 keeps the method and the
 * body; it is used only where the distinction can bite, because 301 is the
 * better-understood answer for a plain page fetch.
 *
 * @param {string} method
 * @returns {number}
 */
export function httpsRedirectStatus(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "GET" || m === "HEAD" ? 301 : 308;
}
