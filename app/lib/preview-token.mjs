/**
 * PURE on purpose: the rules that decide whether a stranger sees an unpublished post must be
 * testable by `node --test`, which cannot import `.ts`. The token is an unsigned lookup key, so
 * revocation is a delete and there is nothing in it to read, edit or forge.
 */

export const TOKEN_BYTES = 32;

/** Derived rather than a typed 43, so it cannot go quietly wrong if the byte count changes. */
export const TOKEN_LENGTH = Math.ceil((TOKEN_BYTES * 4) / 3);

export const PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

const TOKEN_PREFIX = "preview:token:";

const POST_PREFIX = "preview:post:";

/**
 * Anchored and length-exact, because the read path uses it to decide whether to spend a KV read.
 * A prefix match would let `<43 valid chars><anything>` through to the store.
 */
const TOKEN_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${TOKEN_LENGTH}}$`);

/**
 * @returns {string} 43 base64url characters
 */
export function mintToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * Without Buffer: it does not exist in the Worker runtime unless nodejs_compat is on.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * SHAPE ONLY. A true here says nothing about whether the token exists and is not permission.
 *
 * @param {unknown} token
 * @returns {boolean}
 */
export function isWellFormedToken(token) {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

/**
 * @param {string} token
 * @returns {string}
 */
export function tokenKey(token) {
  return `${TOKEN_PREFIX}${token}`;
}

/**
 * @param {string} slug
 * @returns {string}
 */
export function postIndexPrefix(slug) {
  return `${POST_PREFIX}${slug}:`;
}

/**
 * @param {string} slug
 * @param {string} token
 * @returns {string}
 */
export function postIndexKey(slug, token) {
  return `${postIndexPrefix(slug)}${token}`;
}

/**
 * Reads the token off the END rather than splitting on `:`, so it does not depend on
 * `SLUG_PATTERN` continuing to forbid a colon.
 *
 * @param {string} key
 * @param {string} slug
 * @returns {string | null}
 */
export function tokenFromIndexKey(key, slug) {
  const prefix = postIndexPrefix(slug);
  if (!key.startsWith(prefix)) return null;
  const token = key.slice(prefix.length);
  return isWellFormedToken(token) ? token : null;
}

/**
 * @typedef {object} PreviewRecord
 * @property {string} slug
 * @property {string} createdAt
 * @property {string} createdBy
 * @property {string} note
 */

/**
 * @param {{ slug: string, createdAt: string, createdBy: string, note?: string }} input
 * @returns {PreviewRecord}
 */
export function makeRecord(input) {
  return {
    slug: input.slug,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    note: input.note ?? "",
  };
}

/**
 * FAILS CLOSED: a half-read record must never become a partially trusted one.
 *
 * @param {unknown} raw
 * @returns {PreviewRecord | null}
 */
export function parseRecord(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const slug = /** @type {any} */ (parsed).slug;
  if (typeof slug !== "string" || slug.trim() === "") return null;
  return makeRecord({
    slug,
    createdAt: String(/** @type {any} */ (parsed).createdAt ?? ""),
    createdBy: String(/** @type {any} */ (parsed).createdBy ?? ""),
    note: String(/** @type {any} */ (parsed).note ?? ""),
  });
}

/**
 * ADVISORY: KV's `expirationTtl` is what actually expires the key. If they disagree, KV wins.
 *
 * @param {string} createdAt
 * @returns {string} ISO 8601, or "" when createdAt is unreadable
 */
export function expiresAt(createdAt) {
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return "";
  return new Date(at + PREVIEW_TTL_SECONDS * 1000).toISOString();
}

/**
 * The full token is a CAPABILITY: anyone who reads it off a screen holds the link. Six
 * characters is enough to recognize and revoke.
 *
 * @param {string} token
 * @returns {string}
 */
export function truncateToken(token) {
  return token.slice(0, 6);
}

/**
 * @param {string} origin
 * @param {string} token
 * @returns {string}
 */
export function previewUrl(origin, token) {
  return `${origin.replace(/\/+$/, "")}/preview/${token}`;
}

/**
 * The reasons are for server logs and tests only. The route turns every failure into one
 * response, so a stranger cannot learn whether a token or a slug exists.
 *
 * @param {object} input
 * @param {unknown} input.token
 * @param {PreviewRecord | null} input.record
 * @param {{ slug: string, status: string } | null} input.post
 * @returns {{ ok: boolean, reason: "ok" | "malformed" | "unknown" | "mismatch" | "missing-post" | "not-draft" }}
 */
export function resolvePreview({ token, record, post }) {
  if (!isWellFormedToken(token)) return { ok: false, reason: "malformed" };

  // Unknown, expired and revoked are all a KV delete, so they cannot be told apart.
  if (!record) return { ok: false, reason: "unknown" };

  // A deleted draft's tokens outlive it by up to seven days.
  if (!post) return { ok: false, reason: "missing-post" };

  if (record.slug !== post.slug) return { ok: false, reason: "mismatch" };

  // Publishing revokes tokens, but that write can fail and KV is eventually consistent, so the
  // read path re-checks draft status every time.
  if (post.status !== "draft") return { ok: false, reason: "not-draft" };

  return { ok: true, reason: "ok" };
}
