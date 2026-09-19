/**
 * THE MIRROR. Every object in MEDIA has a byte-identical twin in MEDIA_BACKUP.
 *
 * It covers the site's own code, which is the realistic loss: the OG prune, the media delete action
 * and the R2-wins reconciliation can each remove an object with no undo. It does NOT cover account
 * loss or compromise, which needs a copy outside the account and is `check:backup`'s local pull.
 *
 * **NO SITE CODE PATH EVER DELETES FROM THE BACKUP.** There is none here and there must never be one
 * anywhere else either; pruning the mirror is a human act, by hand. `check:destructive` fails on a
 * delete against the `MEDIA_BACKUP` binding, which makes that sentence enforceable rather than
 * aspirational. Copying is the only write here and it cannot lose anything, which is why
 * `media-backup-drift` is allowed to self-repair where `media-unbacked` was not.
 *
 * **NEVER A DUAL WRITE.** The Worker writes ONLY to MEDIA; the queue consumer derives both the D1 row
 * and the twin from the object as it is NOW, never from what the message claimed, so replay and
 * out-of-order delivery converge instead of corrupting.
 */

import type { OperatorEnv } from "~/lib/operator/auth.server";

/** What `Env` must carry for anything in this module to run. */
export type BackupEnv = Pick<OperatorEnv, "MEDIA" | "MEDIA_BACKUP">;

/**
 * ONE ROW of the comparison, so the caller never re-derives identity.
 */
export interface TwinComparison {
  key: string;
  /** Present in the backup at all. */
  present: boolean;
  /** Present AND identical by the rule below. */
  identical: boolean;
  reason: string;
}

export interface BackupStatus {
  objects: number;
  twins: number;
  missing: string[];
  /** Present but NOT identical. Reported separately: a copy would overwrite. */
  mismatched: string[];
}

/**
 * EVERY key in a bucket, following the cursor.
 *
 * `list()` truncates, and a walker that reads the first page and stops reports
 * a clean sweep of the part it read. That is this repo's most-repeated defect
 * class, so the loop is explicit rather than a convenience wrapper.
 */
async function listAll(bucket: R2Bucket) {
  const out: R2Object[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await bucket.list({ cursor, limit: 1000 });
    out.push(...page.objects);
    if (!page.truncated) return out;
    cursor = page.cursor;
  }
}

/**
 * WHETHER TWO OBJECTS ARE THE SAME BYTES: **ETAG, corroborated by SIZE.** For a single-part R2
 * object the etag IS the MD5 of the stored bytes and `list()` returns it free on both sides; every
 * write here is a whole-object `put` under the 10 MB upload cap, so nothing in this bucket is
 * multipart. Not size alone: a same-length corruption is exactly the case a mirror is for.
 *
 * **THE MULTIPART ESCAPE HATCH IS STATED RATHER THAN ASSUMED.** A multipart etag carries a
 * `-<parts>` suffix and is NOT a content digest; if one appears the comparison degrades to size and
 * SAYS SO in the reason, so a weaker verdict cannot be mistaken for the strong one.
 */
function compare(source: R2Object, twin: R2Object | null): TwinComparison {
  if (!twin) {
    return { key: source.key, present: false, identical: false, reason: "no twin" };
  }
  const multipart = source.etag.includes("-") || twin.etag.includes("-");
  if (multipart) {
    const identical = source.size === twin.size;
    return {
      key: source.key,
      present: true,
      identical,
      reason: identical
        ? "size only (a multipart etag is not a content digest)"
        : `size differs: ${source.size} against ${twin.size}`,
    };
  }
  if (source.etag !== twin.etag) {
    return {
      key: source.key,
      present: true,
      identical: false,
      reason: `etag differs: ${source.etag} against ${twin.etag}`,
    };
  }
  if (source.size !== twin.size) {
    // Equal etag with unequal size should be impossible. Reported rather than
    // trusted, because "impossible" is how a silent corruption gets waved past.
    return {
      key: source.key,
      present: true,
      identical: false,
      reason: `etag matches but size differs: ${source.size} against ${twin.size}`,
    };
  }
  return { key: source.key, present: true, identical: true, reason: "etag and size match" };
}

/**
 * The mirror's state, as COUNTS plus the keys behind them.
 *
 * `objects` is reported alongside `twins` and `missing` so that zero missing
 * cannot be mistaken for zero examined. An empty MEDIA bucket answers
 * `0 objects, 0 twins, 0 missing`, and the verdict reads that as vacuous rather
 * than healthy.
 */
export async function backupStatus(env: BackupEnv): Promise<BackupStatus> {
  const [sources, twins] = await Promise.all([listAll(env.MEDIA), listAll(env.MEDIA_BACKUP)]);
  const twinByKey = new Map(twins.map((t) => [t.key, t]));

  const missing: string[] = [];
  const mismatched: string[] = [];
  let identical = 0;

  for (const source of sources) {
    const verdict = compare(source, twinByKey.get(source.key) ?? null);
    if (verdict.identical) identical += 1;
    else if (verdict.present) mismatched.push(`${verdict.key} (${verdict.reason})`);
    else missing.push(verdict.key);
  }

  return { objects: sources.length, twins: identical, missing, mismatched };
}

/**
 * Copy ONE object into the mirror, from the object as it is now. The R2 binding has no server-side
 * copy, so this is a `get` and a whole-object `put`, which keeps the etag a content digest.
 *
 * IDEMPOTENT BY CONSTRUCTION: it re-reads the source and never branches on what a queue message
 * claimed, so replay converges. A source that no longer exists is NOT an error: the twin stays,
 * which is what the mirror is for.
 */
export async function mirrorObject(env: BackupEnv, key: string): Promise<"copied" | "gone"> {
  const object = await env.MEDIA.get(key);
  if (!object) return "gone";
  await env.MEDIA_BACKUP.put(key, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: object.customMetadata,
  });
  return "copied";
}

/**
 * Copy every object that has no identical twin. THE ONLY WRITE, and it adds.
 *
 * Mismatched twins are re-copied as well as absent ones: the source bucket is
 * the truth, and a twin that differs from it is not a backup of anything. The
 * direction is one-way and always this way. Nothing in this repository may copy
 * backup to media, because that would let a stale mirror overwrite a live
 * object, which is the one way a backup can destroy what it exists to protect.
 */
export async function copyMissingTwins(env: BackupEnv): Promise<{
  copied: number;
  gone: number;
  status: BackupStatus;
}> {
  const before = await backupStatus(env);
  const work = [...before.missing, ...before.mismatched.map((m) => m.split(" (")[0] ?? m)];

  let copied = 0;
  let gone = 0;
  for (const key of work) {
    const result = await mirrorObject(env, key);
    if (result === "copied") copied += 1;
    else gone += 1;
  }

  // READ BACK, never the loop's own counters, on the same rule the three syncs
  // follow: the verdict describes the store after the writes.
  const status = await backupStatus(env);
  return { copied, gone, status };
}
