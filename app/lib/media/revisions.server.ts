// A file's byte history (site-api v0.13.0, mediaHistory): every set of bytes an upload has had, so a replace, a
// turn or a mirror can be taken back. The current bytes are the object in MEDIA; each earlier set is copied to
// MEDIA_BACKUP under `replaced/<time>/<key>` before it is overwritten, and that copy is never deleted
// (check:destructive). A revert puts one named copy back: the copy this code wrote, chosen by its revision and
// at the version the editor loaded, never the mirror's twin of a live key (backup.server.ts).

import { NotFoundError } from "@dustinedwards/site-api";
import { replaceObject, type R2BucketLike } from "@dustinedwards/site-api/r2";

import { addMediaRevision, followMediaObject, keepMediaRevision, mediaRevisionsOf, type MediaRevisionRow } from "~/db";
import type { media } from "~/db/schema";

type MediaRow = typeof media.$inferSelect;

export type RevisionReason = "upload" | "import" | "replace" | "transform" | "resize" | "revert";

/** Lower case hex of the bytes' SHA-256, as the media index keeps it. */
export async function sha256Of(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** D1's "YYYY-MM-DD HH:MM:SS" (UTC) or an ISO time, as an ISO time. */
function isoOf(value: string | null | undefined): string {
  const at = value ? Date.parse(value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2Z")) : Number.NaN;
  return new Date(Number.isNaN(at) ? Date.now() : at).toISOString();
}

/** The revision a file with no history has: the bytes it was uploaded with, which are its current ones. */
function firstOf(row: MediaRow) {
  return {
    mediaKey: row.key,
    at: isoOf(row.uploadedAt ?? row.createdAt),
    bytes: row.bytes ?? 0,
    width: row.width,
    height: row.height,
    reason: (row.sourceUrl ? "import" : "upload") as RevisionReason,
    sha256: row.sha256,
  };
}

/** The history as the contract answers it, newest first, exactly one current. A file never changed has one. */
export async function historyOf(env: Env, row: MediaRow) {
  const rows = await mediaRevisionsOf(env, row.key);
  const listed: Array<Omit<MediaRevisionRow, "backupKey" | "mediaKey" | "sha256">> = rows.length > 0 ? rows : [{ id: 0, ...firstOf(row) }];
  return listed.map((r, n) => ({
    rev: String(r.id),
    at: isoOf(r.at),
    bytes: r.bytes,
    width: r.width && r.width > 0 ? r.width : null,
    height: r.height && r.height > 0 ? r.height : null,
    reason: r.reason as RevisionReason,
    current: n === 0,
  }));
}

/** The bytes an earlier revision kept, or null for one this file never had or whose copy is gone. */
export async function revisionBytes(env: Env, key: string, rev: string): Promise<{ row: MediaRevisionRow; bytes: Uint8Array } | null> {
  const row = (await mediaRevisionsOf(env, key)).find((r) => String(r.id) === rev);
  if (!row?.backupKey) return null;
  const kept = await env.MEDIA_BACKUP.get(row.backupKey);
  if (!kept) return null;
  return { row, bytes: new Uint8Array(await kept.arrayBuffer()) };
}

/**
 * Keeps the bytes a file has now as an earlier revision: copied to MEDIA_BACKUP before anything overwrites them,
 * and recorded first if the file had no history. Answers the backup key.
 */
export async function keepCurrentBytes(env: Env, row: MediaRow): Promise<string> {
  const current = await env.MEDIA.get(row.key);
  if (!current) throw new NotFoundError("No such media.");
  const backupKey = `replaced/${new Date().toISOString()}/${row.key}`;
  await env.MEDIA_BACKUP.put(backupKey, current.body, { httpMetadata: current.httpMetadata, customMetadata: current.customMetadata });
  const [latest] = await mediaRevisionsOf(env, row.key, 1);
  const id = latest?.id ?? (await addMediaRevision(env, firstOf(row)));
  await keepMediaRevision(env, id, backupKey);
  return backupKey;
}

/**
 * Puts new bytes under a file's key as its newest revision, the old ones kept first: the one way a stored file's
 * bytes change (replace, transform, revert). The caller has already claimed the version (writeMediaAtRev), so a
 * stale writer never reaches here. `columns` are the index columns that follow the bytes.
 */
export async function swapBytes(
  env: Env,
  row: MediaRow,
  next: { bytes: Uint8Array; contentType: string; width: number | null; height: number | null; reason: RevisionReason },
  columns: Parameters<typeof followMediaObject>[2] = {},
) {
  await keepCurrentBytes(env, row);
  // The binding's `put` takes a wider `onlyIf` than the helper's narrow interface names; the shapes it uses agree.
  await replaceObject(env.MEDIA as unknown as R2BucketLike, row.key, { bytes: next.bytes, contentType: next.contentType });
  const sha256 = await sha256Of(next.bytes);
  await addMediaRevision(env, {
    mediaKey: row.key,
    at: new Date().toISOString(),
    bytes: next.bytes.byteLength,
    width: next.width,
    height: next.height,
    reason: next.reason,
    sha256,
  });
  await followMediaObject(env, row.key, { bytes: next.bytes.byteLength, width: next.width, height: next.height, sha256, ...columns });
}
