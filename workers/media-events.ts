import { deleteMediaRecord, upsertDerivedMedia } from "~/db";
import { bucketFor, classify, isRaster, roleOf, storageOf } from "~/lib/media/classify.mjs";
import { mirrorObject } from "~/lib/media/backup.server";
import { placeholderFor } from "~/lib/media/core.server";

/**
 * The media index write path: R2 emits, a queue delivers, this derives the row.
 *
 * AN EVENT NOTIFICATION, NOT A DUAL WRITE. Writing R2 and then D1 from one request is the dual-write
 * problem: one succeeds, the other fails, and the two diverge silently.
 *
 * R2 IS THE WRITE THAT MATTERS AND THIS CONSUMER IS THE AUTHORITATIVE ROW WRITER. The upload route
 * writes a row for immediacy alone, non-fatally, precisely because this consumer re-derives and
 * overwrites it. R2 WINS any disagreement in both senses: the row is rebuilt from the object, never
 * the reverse, and a row whose object is gone is deleted.
 *
 * IDEMPOTENT BY CONSTRUCTION RATHER THAN BY CHECKING, so a replay, a double delivery and an
 * out-of-order pair all converge. Queues guarantees at-least-once delivery, so this is a requirement.
 *
 * THE OBJECT IS RE-READ RATHER THAN TRUSTED FROM THE EVENT: by the time a notification is handled
 * the object may have been replaced, which is what lets a `PutObject` for a vanished object
 * correctly delete the row instead of resurrecting it.
 */

/**
 * The one thing this consumer needs out of a notification, read defensively rather than typed as a
 * contract. A queue message is external input, so declaring a message type would assert a shape
 * nothing verified. The key is NARROWED out of `unknown` and anything that fails to yield one is a
 * bad message rather than a crashed batch.
 */
function objectKeyOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const object = (body as { object?: unknown }).object;
  if (typeof object !== "object" || object === null) return null;
  const key = (object as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/*
 * `bucketFor` MOVED to `classify.mjs`, and it must be ONE function rather than three that happen
 * to agree. THIS MUST ASK, NOT ASSUME: a missing object is treated as a deletion, so reading the
 * wrong bucket for a key does not merely fail to index, it DELETES the row. Both buckets notify this
 * queue, so the rule has to hold in code rather than in dashboard configuration.
 * Import it; never write a second copy.
 */

export async function handleMediaEvents(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    const key = objectKeyOf(message.body);
    if (!key) {
      // Nothing to act on and nothing a retry would fix. Acked so it does not
      // occupy the queue forever; a malformed notification is not a data loss.
      console.error("media event with no object key", JSON.stringify(message.body));
      message.ack();
      continue;
    }

    try {
      await indexOne(env, key);
      message.ack();
    } catch (error) {
      // RETRY, explicitly. A transient D1 or R2 failure must not be acked, or the row silently never
      // appears and only the health check's media-index-drift would notice. After the configured attempts the platform moves the
      // message to the dead-letter queue.
      console.error(
        `media event failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );
      message.retry();
    }
  }
}

/**
 * Brings the index into line with the object, whatever the event claimed.
 *
 * DELIBERATELY NOT BRANCHING ON THE ACTION. Asking R2 what is true now handles a `PutObject` for
 * something already deleted and a `DeleteObject` for something already replaced, which is what makes
 * out-of-order delivery safe; branching would make the answer depend on an ordering Queues does not
 * promise.
 *
 * A `static` key can never arrive here: those objects are in no bucket and emit no notifications. If
 * one ever does, that is the bug to fix rather than this line.
 */
async function indexOne(env: Env, key: string) {
  const object = await bucketFor(env, key).get(key);

  if (!object) {
    // R2 WINS. The object is gone, so the row goes. Never the reverse: nothing in this file writes to
    // the bucket. LOGGED, because this branch is indistinguishable from the bug it hides: a genuine
    // delete and a key looked for in the wrong bucket both land here and both ack silently.
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
      // An unreadable image still gets a row. NULL already means "not measured" in this schema, and
      // refusing the row outright would make the index disagree with the bucket, which is the one thing it
      // may never do.
    }

    /*
     * THE PLACEHOLDER, DERIVED HERE. Deferring it to the bulk rebuild did not postpone the work, it
     * destroyed it: the row this consumer writes carried no placeholder, and the upsert then erased
     * whatever the last bulk pass had derived.
     *
     * A SECOND R2 GET, because a body is a stream and `.info()` has consumed the first. Same pattern the
     * rebuild uses, for one class B operation per uploaded image.
     *
     * NULL IS A REAL ANSWER. An SVG, a PDF or a corrupt upload has no placeholder and gets a row anyway.
     * `placeholderFor` returns null rather than throwing, so it cannot send an otherwise good row to the
     * dead-letter queue.
     */
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
    // Read off the OBJECT, so this path does not depend on the upload route's D1 write having
    // succeeded. That write is non-fatal by design and a content-addressed key cannot yield a filename,
    // so the name had one source that was allowed to fail. Null for anything uploaded without it, which
    // `upsertDerivedMedia` treats as "do not touch".
    originalName: object.customMetadata?.originalName ?? null,
    // Derived above, from a second read of the same object. Null when the transformer could not read
    // it, which `upsertDerivedMedia` treats as "do not touch" rather than as an instruction to erase.
    placeholder,
    uploadedAt:
      object.uploaded instanceof Date ? object.uploaded.toISOString() : String(object.uploaded ?? ""),
  });

  /*
   * THE SECOND DERIVED ACTION: the mirror.
   *
   * The row and the twin are derived from the SAME object read, so the mirror inherits every property
   * that makes this path replay-safe. It is not a dual write: the Worker writes only to MEDIA.
   *
   * MEDIA ONLY. An `r2-derived` key is an OG card, regenerable by `build:og` and deliberately
   * emptiable, so mirroring it would back up the one thing that already has a rebuild door.
   *
   * NOTHING HERE DELETES A TWIN, and the absence is the design. D1 is a projection of R2 and the
   * backup is not: it is the copy that survives the delete, so pruning the mirror is a human act.
   * `check:destructive` fails on a delete against MEDIA_BACKUP anywhere in this repository.
   *
   * Failure is LOGGED AND SWALLOWED rather than retried: the row is already correct, and a missing
   * twin is drift the health poll sees and `backup_media` repairs.
   */
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
