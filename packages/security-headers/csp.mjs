/**
 * Content-Security-Policy helpers: a per-request nonce, a hash source for an inline script, and a
 * policy built from directives.
 *
 * - generateNonce is foxhound's (app/lib/http/security-headers.ts): 16 random bytes, base64. Call it
 *   once per request and give the same value to the rendered <script nonce> and to the policy.
 * - scriptHash is dustinedwards.info's (workers/csp.mjs): Web Crypto rather than node:crypto, so a
 *   Worker and a Node gate run one function.
 * - buildPolicy is the join both sites wrote by hand.
 *
 * Which to use: a response that is never shared-cached may carry a nonce. A response that is
 * edge-cached must not, since every reader would share one nonce for the cache lifetime; trust its
 * inline scripts by hash instead, with 'strict-dynamic' for what they insert.
 */

/** @returns {string} a fresh nonce, 24 base64 characters */
export function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * @param {string} text an inline script's exact text, as the page renders it
 * @returns {Promise<string>} `sha256-<base64>`, without the quotes the policy puts round it
 */
export async function scriptHash(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
}

/**
 * The policy string from directives in the order given: `["default-src 'self'", "object-src 'none'"]`
 * becomes `default-src 'self'; object-src 'none'`. Order is kept, so a gate comparing strings sees
 * exactly what the site wrote.
 *
 * @param {readonly string[]} directives
 * @returns {string}
 */
export function buildPolicy(directives) {
  const empty = directives.filter((d) => d.trim() === "");
  if (empty.length > 0) throw new Error("a CSP directive is empty");
  return directives.join("; ");
}
