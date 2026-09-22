/**
 * Draft preview links: the token, the key shapes, and the resolve verdict.
 *
 * PURE, and that is the point rather than a style preference. Everything here is
 * a function of its arguments: no KV, no database, no request, no clock it does
 * not receive. The KV-touching code in `preview-links.server.ts` is a thin shell
 * around these, so the rules that decide whether a stranger sees an unpublished
 * post are testable by `node --test` instead of only by deploying.
 *
 * `.mjs` for the same reason `publish-policy.mjs` and `intent.mjs` are: the test
 * runner cannot import a `.ts` module, and a rule this repo cannot execute in a
 * test is a rule it verifies by reading. Hard rule 12 is the standing argument.
 *
 * ## What a preview link IS
 *
 * A 32-byte random token, base64url, naming a KV record that names one slug. It
 * is not signed and it carries no claims: it is a lookup key, so revocation is a
 * delete rather than a blocklist, and there is nothing in the token itself an
 * attacker can read, edit or forge into a different post. The authority is the
 * stored record; the token is only how you find it.
 *
 * 32 bytes is 256 bits. Guessing one is not a thing anyone does, and the rate
 * limit on the read path is there for the traffic such an attempt would make,
 * not because the space is reachable.
 */

/** Bytes of entropy per token. 256 bits. */
export const TOKEN_BYTES = 32;

/**
 * Length of the base64url encoding of {@link TOKEN_BYTES}, unpadded.
 *
 * DERIVED, not typed in twice. 32 bytes is 43 base64 characters plus one `=` of
 * padding, and the padding is dropped, so a hand-written 43 here would be a
 * second source for the same fact and would go quietly wrong the day the byte
 * count changes.
 */
export const TOKEN_LENGTH = Math.ceil((TOKEN_BYTES * 4) / 3);

/** Seven days, in seconds. What KV is given as `expirationTtl`. */
export const PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

/** KV prefix for the AUTHORITY record: token -> {slug, createdAt, ...}. */
export const TOKEN_PREFIX = "preview:token:";

/** KV prefix for the per-slug INDEX: slug + token -> empty. */
export const POST_PREFIX = "preview:post:";

/**
 * The character set of an unpadded base64url string, anchored.
 *
 * Anchored at both ends and length-exact, because the read path uses this to
 * decide whether to spend a KV read at all. A prefix match would let
 * `<43 valid chars><anything>` through to the store.
 */
const TOKEN_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${TOKEN_LENGTH}}$`);

/**
 * A fresh token.
 *
 * `crypto.getRandomValues` in both runtimes: it is on `globalThis.crypto` in
 * Workers and in Node since 19. `Math.random` is not a candidate and is named
 * here so nobody offers it as a simplification.
 *
 * @returns {string} 43 base64url characters
 */
export function mintToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * base64url, unpadded, without Buffer.
 *
 * `Buffer` does not exist in the Worker runtime unless nodejs_compat is on, and
 * this module is imported by the Worker. `btoa` is in both.
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
 * Whether a string could be a token this module minted.
 *
 * SHAPE ONLY. It says nothing about whether the token exists, which is the
 * store's answer, and a caller must not read a true here as permission.
 *
 * @param {unknown} token
 * @returns {boolean}
 */
export function isWellFormedToken(token) {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

/**
 * The authority key. Holds the JSON record; deleting it revokes the link.
 *
 * @param {string} token
 * @returns {string}
 */
export function tokenKey(token) {
  return `${TOKEN_PREFIX}${token}`;
}

/**
 * The prefix every index entry for one slug shares. What `list` is given when
 * a save moves the post out of draft and every token has to go.
 *
 * @param {string} slug
 * @returns {string}
 */
export function postIndexPrefix(slug) {
  return `${POST_PREFIX}${slug}:`;
}

/**
 * The index key. Empty value: it exists to be ENUMERATED, and everything worth
 * knowing is in the authority record the token names.
 *
 * @param {string} slug
 * @param {string} token
 * @returns {string}
 */
export function postIndexKey(slug, token) {
  return `${postIndexPrefix(slug)}${token}`;
}

/**
 * The token an index key names, or null if the key is not one of ours.
 *
 * Reads the token off the END rather than splitting on `:`, because a slug is
 * allowed to contain characters this code does not get to choose and a split
 * would silently mis-parse the day one does. `SLUG_PATTERN` forbids a colon
 * today; this does not depend on that staying true.
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
 * The record written under {@link tokenKey}.
 *
 * @typedef {object} PreviewRecord
 * @property {string} slug        the post this link shows, and the only one
 * @property {string} createdAt   ISO 8601, when it was minted
 * @property {string} createdBy   who asked for it, for the drawer's list
 * @property {string} note        free text, may be empty
 */

/**
 * Builds the authority record. Separate from the KV write so a test can see it.
 *
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
 * Parses a stored record, refusing anything that is not one.
 *
 * FAILS CLOSED. A record that will not parse, or that carries no slug, resolves
 * to null and the read path treats it exactly as it treats a missing key. A
 * half-read record must never become a partially trusted one.
 *
 * @param {unknown} raw the KV value, as text
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
 * When a link minted at `createdAt` stops working.
 *
 * ADVISORY, and that word is load-bearing. KV's `expirationTtl` is what actually
 * expires the key; this exists so the drawer can print a date and so the number
 * shown to a human comes from the same constant the store was given. If they
 * ever disagree, KV wins and the UI is the defect.
 *
 * @param {string} createdAt ISO 8601
 * @returns {string} ISO 8601, or "" when createdAt is unreadable
 */
export function expiresAt(createdAt) {
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return "";
  return new Date(at + PREVIEW_TTL_SECONDS * 1000).toISOString();
}

/**
 * The token, shortened for display. Six characters, per the ratified spec.
 *
 * The full token is a CAPABILITY: anyone who reads it off a screen holds the
 * link. The list is for recognizing and revoking, which six characters is
 * enough for, and the whole value is behind the copy action alone.
 *
 * @param {string} token
 * @returns {string}
 */
export function truncateToken(token) {
  return token.slice(0, 6);
}

/**
 * The absolute URL for a token.
 *
 * @param {string} origin e.g. https://example.com, no trailing slash
 * @param {string} token
 * @returns {string}
 */
export function previewUrl(origin, token) {
  return `${origin.replace(/\/+$/, "")}/preview/${token}`;
}

/**
 * THE VERDICT. Every way a preview can fail, in one function.
 *
 * The caller hands over what it found and this decides; it does no lookups
 * itself. That is what makes "an orphaned index entry resolves to a missing
 * token" and "a post that left draft stops previewing" testable without a store.
 *
 * **Every failure is the same outcome to the caller.** The reasons below are for
 * the SERVER's own logs and for tests. The route turns all of them into one
 * response, because telling a stranger whether a token exists, or whether a slug
 * is a real post, is telling them something they cannot otherwise learn.
 *
 * @param {object} input
 * @param {unknown} input.token   whatever came off the URL
 * @param {PreviewRecord | null} input.record  the parsed authority record
 * @param {{ slug: string, status: string } | null} input.post the row, if any
 * @returns {{ ok: boolean, reason: "ok" | "malformed" | "unknown" | "mismatch" | "missing-post" | "not-draft" }}
 */
export function resolvePreview({ token, record, post }) {
  // Shape first, so a malformed token never costs a store read. The route
  // checks this before it calls KV; this repeats it so the verdict is total.
  if (!isWellFormedToken(token)) return { ok: false, reason: "malformed" };

  // No record means unknown, expired or revoked, and this function CANNOT tell
  // those apart. That is not a limitation: expiry is a KV delete and revocation
  // is a KV delete, so by the time anything reads, they are the same fact.
  if (!record) return { ok: false, reason: "unknown" };

  // The post is gone. A deleted draft's tokens outlive it by up to seven days.
  if (!post) return { ok: false, reason: "missing-post" };

  // THE ORPHAN AND THE CROSSED WIRE. The record names a slug and the caller
  // looked one up; if those disagree, something upstream fetched the wrong row
  // and the safe answer is no. It cannot happen through the route as written,
  // which is exactly why it is asserted here rather than assumed.
  if (record.slug !== post.slug) return { ok: false, reason: "mismatch" };

  // THE ONE THAT MATTERS ON PUBLISH. A save that moves a post out of draft
  // revokes its tokens, but revocation is a write and writes can fail, and KV
  // is eventually consistent besides. So the read path does not trust that the
  // revocation happened: it re-asks the database every time. Same stance as
  // Ask's citation re-check on a cache hit.
  if (post.status !== "draft") return { ok: false, reason: "not-draft" };

  return { ok: true, reason: "ok" };
}
