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
 * The two KV writes are not transactional, so both operations put the token (authority) key at the
 * end of the window they can fail in. A crash in revoke leaves an orphaned index entry, which is why
 * `list` skips an entry whose authority record is gone.
 */

interface PreviewLink {
  /** The whole token. Reaches the page ONLY inside the copy control's value. */
  token: string;
  short: string;
  /** ISO 8601, or "" when the stored record carried no readable date. */
  createdAt: string;
  /** Advisory: KV's expirationTtl is what actually expires the key. */
  expiresAt: string;
  createdBy: string;
  note: string;
}

type PreviewEnv = { APP_KV: KVNamespace };

/**
 * The CALLER decides whether the post is a draft. A token minted against a published post is inert,
 * because the read path refuses to serve one.
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

  const options = { expirationTtl: PREVIEW_TTL_SECONDS };
  await env.APP_KV.put(tokenKey(token), JSON.stringify(record), options);
  await env.APP_KV.put(postIndexKey(input.slug, token), "", options);

  return toLink(token, record);
}

export async function revokePreviewLink(
  env: PreviewEnv,
  input: { slug: string; token: string },
): Promise<void> {
  if (!isWellFormedToken(input.token)) return;
  await env.APP_KV.delete(tokenKey(input.token));
  await env.APP_KV.delete(postIndexKey(input.slug, input.token));
}

/** Skips an orphaned index entry: listing it would offer a link that does not work. */
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

  // An empty createdAt sorts last, so an unreadable date cannot claim to be the newest link.
  return links.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

/**
 * Enumerates the index rather than remembering what was minted, so a token from a long-ended
 * session is still reached. Returns the count so "0 revoked" and "the list call failed" differ.
 */
export async function revokeAllPreviewLinks(
  env: PreviewEnv,
  slug: string,
): Promise<number> {
  const listed = await env.APP_KV.list({ prefix: postIndexPrefix(slug) });

  let revoked = 0;
  for (const entry of listed.keys) {
    const token = tokenFromIndexKey(entry.name, slug);
    // An index key whose tail is not a token is still deleted: it is ours by prefix, and leaving
    // it would make the count wrong forever.
    if (token) {
      await env.APP_KV.delete(tokenKey(token));
      revoked += 1;
    }
    await env.APP_KV.delete(entry.name);
  }
  return revoked;
}

/** Rejects a malformed token WITHOUT touching KV, because the read path is public. */
export async function readPreviewRecord(
  env: PreviewEnv,
  token: string,
): Promise<PreviewRecord | null> {
  if (!isWellFormedToken(token)) return null;
  return parseRecord(await env.APP_KV.get(tokenKey(token)));
}

/**
 * Loose for a human opening a link, tight against enumeration. The token space (256 bits) is what
 * makes guessing safe; this only stops the traffic.
 */
export const PREVIEW_RATE_LIMIT = 30;

export const PREVIEW_RATE_WINDOW_SECONDS = 60;

/**
 * FAILS CLOSED when the binding is absent: an unprotected public path that serves unpublished
 * content must not serve.
 */
export async function checkPreviewRate(
  env: Env,
  ip: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  if (!env.ASK_BUDGET) {
    return { ok: false, retryAfter: PREVIEW_RATE_WINDOW_SECONDS };
  }
  // Keyed `preview:` rather than `ip:`, so preview traffic does not spend an Ask caller's counter.
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`preview:${ip}`));
  const { ok } = await limiter.hit(PREVIEW_RATE_LIMIT, PREVIEW_RATE_WINDOW_SECONDS);
  return { ok, retryAfter: PREVIEW_RATE_WINDOW_SECONDS };
}

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
