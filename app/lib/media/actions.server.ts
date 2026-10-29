import {
  mediaCounts,
  mediaRecord,
  mediaRefsFor,
  mediaRoleCounts,
  restoreMediaRecord,
  setMediaTags,
  trashMediaRecord,
  writeMediaAtRev,
  type MediaWriteOutcome,
} from "~/db";
import type { MediaRef } from "~/db/schema";
import { storageOf } from "./classify.mjs";
import { isManagedKey } from "./core.server";
import { rebuildMediaIndex } from "./rebuild.server";
import { resolveCitations, type MediaCitation } from "./resolvers.server";

/*
 * The media index's writes and checks, under Carrel's media adapter, which the admin library also runs
 * through site-api's content kit, and the rebuild on /admin/tools.
 */

type Message = { message: string };

/*
 * The core writes: plain values in, plain values out, under Carrel's media adapter, so the site has one
 * write path for alt, tags and trash. Each lands in one revision-checked statement (writeMediaAtRev);
 * `expectedRev` is the version the caller loaded.
 */

/** What one core write did. `changed` is false when the row was already in the asked-for state. */
export type MediaWrite =
  | { ok: true; rev: number; changed: boolean }
  | { ok: false; reason: "missing" | "static" | "unmanaged" }
  | { ok: false; reason: "stale"; rev: number };

export type MediaWriteOptions = { expectedRev?: number; storedOnly?: boolean };

/** Reads a write's outcome: a missing key, a stale version, a static row, or a no-op on a row already there. */
export function settleMediaWrite(outcome: MediaWriteOutcome, options: MediaWriteOptions): MediaWrite {
  if (outcome.written) return { ok: true, rev: outcome.rev, changed: true };
  const { row } = outcome;
  if (!row) return { ok: false, reason: "missing" };
  if (options.storedOnly && row.storage === "static") return { ok: false, reason: "static" };
  if (options.expectedRev !== undefined && row.rev !== options.expectedRev) {
    return { ok: false, reason: "stale", rev: row.rev };
  }
  return { ok: true, rev: row.rev, changed: false };
}

/** Saving alt rewrites no post: alt is contextual, so only future insertions pick it up. Uploads only. */
export async function applyMediaAlt(
  env: Env,
  key: string,
  alt: string,
  options: MediaWriteOptions = {},
): Promise<MediaWrite> {
  if (!isManagedKey(key)) return { ok: false, reason: (await mediaRecord(env, key)) ? "unmanaged" : "missing" };
  return settleMediaWrite(await writeMediaAtRev(env, key, { alt }, options), options);
}

/** The whole tag set, in whatever spelling `serializeTags` accepts. */
export async function applyMediaTags(
  env: Env,
  key: string,
  tags: string[] | string,
  options: MediaWriteOptions = {},
): Promise<MediaWrite & { tags: string[] }> {
  const saved = await setMediaTags(env, key, tags, options);
  return { ...settleMediaWrite(saved.outcome, options), tags: saved.tags };
}

/** Hides a file from the library; R2 and its address are untouched, so a page using it is unchanged. */
export async function applyMediaTrash(env: Env, key: string, options: MediaWriteOptions = {}) {
  return settleMediaWrite(await trashMediaRecord(env, key, options), options);
}

export async function applyMediaRestore(env: Env, key: string, options: MediaWriteOptions = {}) {
  return settleMediaWrite(await restoreMediaRecord(env, key, options), options);
}

/** The row count the rebuild confirmation shows. */
export async function mediaRowTotal(env: Env) {
  const before = await mediaCounts(env);
  return before.reduce((sum, row) => sum + Number(row.n), 0);
}

/** Runs the rebuild the route has confirmed and reports what the index holds after it. */
export async function rebuildMedia(env: Env): Promise<Message> {
  const report = await rebuildMediaIndex(env);
  const after = await mediaCounts(env);
  const total = after.reduce((sum, row) => sum + Number(row.n), 0);
  const breakdown = after
    .map((row) => `${row.n} ${row.storage}/${row.kind}`)
    .sort()
    .join(", ");
  const roles = await mediaRoleCounts(env);
  const roleBreakdown = roles
    .map((row) => `${row.n} ${row.role}`)
    .sort()
    .join(", ");

  const parts = [
    `Rebuilt from ${report.scannedObjects} R2 object(s) and ${report.scannedFiles} static ` +
      `file(s). The index now holds ${total} row(s): ${breakdown}`,
    `By role: ${roleBreakdown}`,
  ];
  if (report.removed > 0) {
    parts.push(`${report.removed} row(s) removed for sources that no longer exist`);
  }
  if (report.failures.length > 0) {
    parts.push(
      `${report.failures.length} could not be derived: ${report.failures.slice(0, 3).join("; ")}` +
        (report.failures.length > 3 ? ` and ${report.failures.length - 3} more` : ""),
    );
  }
  parts.push("Alt text, captions and focal points were preserved");
  return { message: `${parts.join(". ")}.` };
}

/** Every place one key is used, on a fresh read: the resolver scan and the pipeline's recorded refs. */
export async function mediaUsage(env: Env, key: string) {
  const [resolution, refs] = await Promise.all([
    resolveCitations(env, [key]),
    mediaRefsFor(env, [key]),
  ]);
  return {
    complete: resolution.complete,
    failed: resolution.failed,
    citations: resolution.citations.get(key) ?? [],
    refs: refs.get(key) ?? [],
  };
}

/**
 * Whether one key may be deleted, as a verdict rather than prose, so the admin action and Carrel's
 * media adapter refuse on the same checks. `clear` still has to win the atomic claim.
 */
export type MediaDeleteVerdict =
  | { kind: "static" }
  | { kind: "unmanaged" }
  | { kind: "scan-failed"; failed: string[] }
  | { kind: "cited"; citations: MediaCitation[]; refs: MediaRef[] }
  | { kind: "clear" };

export async function mediaDeleteVerdict(env: Env, key: string): Promise<MediaDeleteVerdict> {
  // Refused in the action, not by hiding a button: a deleted row would return on the next rebuild.
  if (storageOf(key) === "static") return { kind: "static" };
  if (!isManagedKey(key)) return { kind: "unmanaged" };

  // Server side on a fresh read: a post may have cited the object since the page rendered.
  const usage = await mediaUsage(env, key);

  // Fail closed: a failed scan is not "nothing cites it".
  if (!usage.complete) return { kind: "scan-failed", failed: usage.failed };

  // The refcount: content-addressed keys let posts share a blob, so any citation blocks the delete.
  if (usage.refs.length > 0 || usage.citations.length > 0) {
    return { kind: "cited", citations: usage.citations, refs: usage.refs };
  }
  return { kind: "clear" };
}
