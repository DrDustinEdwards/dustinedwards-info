import {
  PREVIEW_TTL_SECONDS,
  expiresAt,
  isWellFormedToken,
  makeRecord,
  mintToken,
  parseRecord,
  postIndexKey,
  postIndexPrefix,
  tokenFromIndexKey,
  tokenKey,
  truncateToken,
  type PreviewRecord,
} from "~/lib/preview-token.mjs";

/**
 * The KV half of draft preview links. Deliberately THIN: every rule lives in `preview-token.mjs`,
 * which is pure and unit tested, so this file only reads and writes.
 *
 * Two keys, written together and deleted together. `preview:token:<token>` is the AUTHORITY and
 * deleting it revokes; `preview:post:<slug>:<token>` is the INDEX, empty, and exists so "list this
 * post's links" and "revoke every link" are possible at all.
 *
 * **THEY ARE NOT TRANSACTIONAL AND THIS CODE DOES NOT PRETEND THEY ARE.** Both operations put the
 * AUTHORITY at the end of the window they can fail in, because it is the dangerous artifact. A crash
 * in CREATE leaves a live token no listing shows, which still expires and still stops working the
 * moment the post leaves draft; a crash in REVOKE leaves an ORPHANED INDEX ENTRY, which is why
 * `list` skips an entry whose authority record is gone.
 */

/** What the edit route's drawer renders for one live link. */
export interface PreviewLink {
  /** The whole token. Reaches the page ONLY inside the copy control's value. */
  token: string;
  /** Six characters, which is what is printed. */
  short: string;
  /** ISO 8601, or "" when the stored record carried no readable date. */
  createdAt: string;
  /** ISO 8601. Advisory: KV's expirationTtl is what actually expires the key. */
  expiresAt: string;
  createdBy: string;
  note: string;
}

/** The bindings this module needs. Narrower than `Env` so tests can stand in. */
type PreviewEnv = { APP_KV: KVNamespace };

/**
 * Mints a link for a draft and returns it.
 *
 * The CALLER decides whether the post is a draft. This module does not read the
 * database: it is the store, not the policy. The route refuses to offer either
 * intent on a published post, and the read path refuses to serve one, so a
 * token minted against a published post would be inert rather than a leak.
 */
export async function createPreviewLink(
  env: PreviewEnv,
  input: { slug: string; createdBy: string; note?: string; now?: Date },
): Promise<PreviewLink> {
  const token = mintToken();
  const record = makeRecord({
    slug: input.slug,
    createdAt: (input.now ?? new Date()).toISOString(),
    createdBy: input.createdBy,
    note: input.note ?? "",
  });

  // BOTH keys carry the same TTL, so neither outlives the other by design.
  // The orphan case this file documents is a failed write, not an ordinary one.
  const options = { expirationTtl: PREVIEW_TTL_SECONDS };
  await env.APP_KV.put(tokenKey(token), JSON.stringify(record), options);
  await env.APP_KV.put(postIndexKey(input.slug, token), "", options);

  return toLink(token, record);
}

/**
 * Revokes one link: both keys, authority first.
 *
 * Idempotent. Revoking a token that is already gone is not an error, because
 * the author cannot tell a revoked link from an expired one and should not have
 * to. `delete` on a missing key is a no-op in KV.
 */
export async function revokePreviewLink(
  env: PreviewEnv,
  input: { slug: string; token: string },
): Promise<void> {
  if (!isWellFormedToken(input.token)) return;
  await env.APP_KV.delete(tokenKey(input.token));
  await env.APP_KV.delete(postIndexKey(input.slug, input.token));
}

/**
 * Every live link for a post, newest first.
 *
 * SKIPS an entry whose authority record is missing, which is the orphan case
 * above. A listing that showed it would be offering a link that does not work
 * and inviting the author to hand it to someone.
 */
export async function listPreviewLinks(
  env: PreviewEnv,
  slug: string,
): Promise<PreviewLink[]> {
  const listed = await env.APP_KV.list({ prefix: postIndexPrefix(slug) });

  const links: PreviewLink[] = [];
  for (const entry of listed.keys) {
    const token = tokenFromIndexKey(entry.name, slug);
    if (!token) continue;
    const record = parseRecord(await env.APP_KV.get(tokenKey(token)));
    if (!record) continue;
    links.push(toLink(token, record));
  }

  // Newest first. An empty createdAt sorts last rather than first, so a record
  // with an unreadable date cannot claim to be the newest link.
  return links.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

/**
 * Revokes EVERY link for a post. Called from the publish path.
 *
 * Enumerates the index rather than remembering what was minted, so a token
 * created by a session that has long since ended is still reached.
 *
 * Returns how many were revoked, because "0 revoked" and "the list call failed"
 * must not look the same to the caller that reports it.
 */
export async function revokeAllPreviewLinks(
  env: PreviewEnv,
  slug: string,
): Promise<number> {
  const listed = await env.APP_KV.list({ prefix: postIndexPrefix(slug) });

  let revoked = 0;
  for (const entry of listed.keys) {
    const token = tokenFromIndexKey(entry.name, slug);
    // An index key whose tail is not a token is still deleted: it is ours by
    // prefix, nothing can use it, and leaving it would make the count wrong
    // forever. Only the authority delete needs a real token.
    if (token) {
      await env.APP_KV.delete(tokenKey(token));
      revoked += 1;
    }
    await env.APP_KV.delete(entry.name);
  }
  return revoked;
}

/**
 * The authority record a token names, or null.
 *
 * Returns null for a malformed token WITHOUT touching KV. A 43-character
 * pattern is cheaper than a store read, and the read path is public.
 */
export async function readPreviewRecord(
  env: PreviewEnv,
  token: string,
): Promise<PreviewRecord | null> {
  if (!isWellFormedToken(token)) return null;
  return parseRecord(await env.APP_KV.get(tokenKey(token)));
}

/**
 * Requests one IP may make to the preview path inside {@link PREVIEW_RATE_WINDOW_SECONDS}.
 *
 * 30 per minute: loose for a human opening a link, tight against anything enumerating. It is NOT the
 * reason the token space is safe, which is 256 bits; it is here so the traffic such an attempt would
 * make stops.
 */
export const PREVIEW_RATE_LIMIT = 30;

/** The window the limit is counted over. */
export const PREVIEW_RATE_WINDOW_SECONDS = 60;

/**
 * The per-IP burst limit on the preview path. THE ASK LIMITER'S DURABLE OBJECT, one instance per
 * IP, `hit()` doing a synchronous read-and-write so the count cannot be raced; the measurements
 * that ruled out the `ratelimit` binding and a KV counter are in `workers/ask-budget.ts`.
 *
 * FAILS CLOSED when the binding is absent, exactly as `checkAskRate` does. An unprotected public
 * path that serves unpublished content must not serve.
 */
export async function checkPreviewRate(
  env: Env,
  ip: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  if (!env.ASK_BUDGET) {
    return { ok: false, retryAfter: PREVIEW_RATE_WINDOW_SECONDS };
  }
  // Keyed `preview:` rather than `ip:`, so a reviewer opening preview links is
  // not spending the same counter as an Ask caller from the same address. Two
  // limits on two surfaces, not one shared allowance.
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`preview:${ip}`));
  const { ok } = await limiter.hit(PREVIEW_RATE_LIMIT, PREVIEW_RATE_WINDOW_SECONDS);
  return { ok, retryAfter: PREVIEW_RATE_WINDOW_SECONDS };
}

/** @param token @param record */
function toLink(token: string, record: PreviewRecord): PreviewLink {
  return {
    token,
    short: truncateToken(token),
    createdAt: record.createdAt,
    expiresAt: expiresAt(record.createdAt),
    createdBy: record.createdBy,
    note: record.note,
  };
}
