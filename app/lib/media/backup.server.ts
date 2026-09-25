// NO SITE CODE PATH EVER DELETES FROM THE BACKUP (check:destructive enforces it), and nothing copies
// backup to media, which would let a stale mirror overwrite a live object.

import type { OperatorEnv } from "~/lib/operator/auth.server";

type BackupEnv = Pick<OperatorEnv, "MEDIA" | "MEDIA_BACKUP">;

interface TwinComparison {
  key: string;
  present: boolean;
  identical: boolean;
  reason: string;
}

interface BackupStatus {
  objects: number;
  /**
   * IDENTICAL twins only: a backup copy that differs is counted in `mismatched`, not here. Named
   * `twins` because the operator API reports it under that key.
   */
  twins: number;
  missing: string[];
  mismatched: string[];
}

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

// ETag is the MD5 of a single-part object, corroborated by size (a same-length corruption is what a
// mirror is for). A multipart etag (`-<parts>`) is not a digest, so that case degrades to size and says so.
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
    // Should be impossible; reported rather than trusted.
    return {
      key: source.key,
      present: true,
      identical: false,
      reason: `etag matches but size differs: ${source.size} against ${twin.size}`,
    };
  }
  return { key: source.key, present: true, identical: true, reason: "etag and size match" };
}

// The mismatched keys travel beside the display strings, so a repair never parses a key back out of
// prose: a key containing " (" would be cut short and the wrong object copied.
async function compareBuckets(env: BackupEnv) {
  const [sources, twins] = await Promise.all([listAll(env.MEDIA), listAll(env.MEDIA_BACKUP)]);
  const twinByKey = new Map(twins.map((t) => [t.key, t]));

  const missing: string[] = [];
  const mismatched: string[] = [];
  const mismatchedKeys: string[] = [];
  let identicalTwins = 0;

  for (const source of sources) {
    const verdict = compare(source, twinByKey.get(source.key) ?? null);
    if (verdict.identical) identicalTwins += 1;
    else if (verdict.present) {
      mismatched.push(`${verdict.key} (${verdict.reason})`);
      mismatchedKeys.push(verdict.key);
    } else missing.push(verdict.key);
  }

  const status: BackupStatus = { objects: sources.length, twins: identicalTwins, missing, mismatched };
  return { status, mismatchedKeys };
}

// `objects` is reported so zero missing cannot be mistaken for zero examined.
export async function backupStatus(env: BackupEnv): Promise<BackupStatus> {
  return (await compareBuckets(env)).status;
}

// R2 bindings have no server-side copy. Re-reads the source rather than trusting a queue message, so
// replay converges; a source that is gone is not an error, since the twin staying is the point.
export async function mirrorObject(env: BackupEnv, key: string): Promise<"copied" | "gone"> {
  const object = await env.MEDIA.get(key);
  if (!object) return "gone";
  await env.MEDIA_BACKUP.put(key, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: object.customMetadata,
  });
  return "copied";
}

// Mismatched twins are re-copied too: the source bucket is the truth.
export async function copyMissingTwins(env: BackupEnv): Promise<{
  copied: number;
  gone: number;
  status: BackupStatus;
}> {
  const before = await compareBuckets(env);
  const work = [...before.status.missing, ...before.mismatchedKeys];

  let copied = 0;
  let gone = 0;
  for (const key of work) {
    const result = await mirrorObject(env, key);
    if (result === "copied") copied += 1;
    else gone += 1;
  }

  // Read back rather than trusting the loop's counters.
  const status = await backupStatus(env);
  return { copied, gone, status };
}
