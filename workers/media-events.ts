import { deleteMediaRecord, upsertDerivedMedia } from "~/db";
import { bucketFor, classify, isRaster, roleOf, storageOf } from "~/lib/media/classify.mjs";
import { mirrorObject } from "~/lib/media/backup.server";
import { placeholderFor } from "~/lib/media/core.server";

/**
 * The authoritative media row writer, fed by R2 event notifications rather than a dual write. Must be
 * idempotent: Queues delivers at least once and out of order, so the object is re-read, never trusted
 * from the event, and R2 wins any disagreement.
 */

function objectKeyOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const object = (body as { object?: unknown }).object;
  if (typeof object !== "object" || object === null) return null;
  const key = (object as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

// A missing object deletes the row, so reading the wrong bucket for a key deletes it too. Use the
// shared `bucketFor`; never write a second copy.

export async function handleMediaEvents(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    const key = objectKeyOf(message.body);
    if (!key) {
      console.error("media event with no object key", JSON.stringify(message.body));
      message.ack();
      continue;
    }

    try {
      await indexOne(env, key);
      message.ack();
    } catch (error) {
      // Never ack a transient failure, or the row silently never appears.
      console.error(
        `media event failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );
      message.retry();
    }
  }
}

/** Ignores the event's action on purpose: asking R2 what is true now makes reordering safe. */
async function indexOne(env: Env, key: string) {
  const object = await bucketFor(env, key).get(key);

  if (!object) {
    // Logged, because a genuine delete and a key looked up in the wrong bucket both land here.
    console.log(
      `media event: no object for ${JSON.stringify(key)} in ` +
        `${storageOf(key) === "r2-derived" ? "OG" : "MEDIA"}; deleting any row`,
    );
    await deleteMediaRecord(env, key);
    return;
  }

  const { kind, mime } = classify(key);

  let width: number | null = null;
  let height: number | null = null;
  let placeholder: string | null = null;
  if (isRaster(key)) {
    try {
      const info = await env.IMAGES.info(object.body);
      if ("width" in info && "height" in info) {
        width = info.width;
        height = info.height;
      }
    } catch {
      // An unreadable image still gets a row, or the index would disagree with the bucket.
    }

    // Derived here, or the upsert erases the bulk pass's placeholder. A second GET, because `.info()`
    // consumed the first body stream.
    const reread = await bucketFor(env, key).get(key);
    if (reread) placeholder = await placeholderFor(env, reread.body);
  }

  await upsertDerivedMedia(env, {
    key,
    storage: storageOf(key),
    kind,
    role: roleOf(key),
    mime,
    bytes: object.size,
    width,
    height,
    // From the object: a content-addressed key cannot yield a filename. Null means "do not touch".
    originalName: object.customMetadata?.originalName ?? null,
    // Null means "do not touch", not "erase".
    placeholder,
    uploadedAt:
      object.uploaded instanceof Date ? object.uploaded.toISOString() : String(object.uploaded ?? ""),
  });

  // Nothing here deletes a backup twin: the backup is the copy that survives a delete. OG cards are
  // regenerable, so not mirrored. A failed mirror is swallowed; the health poll sees the drift.
  if (storageOf(key) === "r2") {
    try {
      await mirrorObject(env, key);
    } catch (error) {
      console.log(
        `media event: mirror failed for ${JSON.stringify(key)}: ` +
          `${error instanceof Error ? error.message : String(error)}. ` +
          `The row stands; media-backup-drift will report it and backup_media repairs it.`,
      );
    }
  }
}
