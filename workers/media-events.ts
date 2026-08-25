import { deleteMediaRecord, upsertDerivedMedia } from "~/db";
import { bucketFor, classify, isRaster, roleOf, storageOf } from "~/lib/media/classify.mjs";

/**
 * The media index write path: R2 emits, a queue delivers, this derives the row.
 *
 * **This is an event notification, NOT a dual write, and the distinction is the
 * whole ruling** (decisions.md, 2026-08-02). Writing R2 and then writing D1 from
 * the same request is the classic dual-write problem: one succeeds, the other
 * fails, and the two systems diverge silently with nothing to detect it. The
 * upload route already swallowed that failure, which was correct while D1 was a
 * mere annotation and becomes a drift generator the moment D1 is the index.
 *
 * So: **R2 is the write that matters, and this consumer is the authoritative
 * row writer.** The upload route does write a D1 row after its put, non-fatally
 * and for immediacy alone, so the library shows a fresh upload without waiting
 * on a queue; that write is allowed to fail precisely because this consumer
 * re-derives the row from the object and overwrites whatever the route managed.
 * The bucket emits an event, this consumer derives the row from what the object
 * IS, the platform retries on failure, and a permanent failure lands in a
 * dead-letter queue rather than a log line nobody reads. R2 wins any
 * disagreement, in both senses: the row is rebuilt from the object, never the
 * reverse, and a row whose object is gone is deleted. (An earlier version of
 * this paragraph claimed R2 was the Worker's only write target, which the
 * upload route's write-through falsified; the originalName note below already
 * admitted it.)
 *
 * **Idempotent, and by construction rather than by checking.** Every message is
 * handled by re-deriving the row from the object as it is RIGHT NOW and
 * upserting it. Replaying a message, delivering it twice, or delivering two
 * messages out of order all converge on the same state, because none of the
 * handling depends on what the message says the object used to be. Queues
 * guarantees at-least-once delivery, so this is a requirement and not a nicety.
 *
 * **The object is re-read rather than trusted from the event.** A notification
 * carries a size and an etag, but by the time it is handled the object may have
 * been replaced or deleted. Reading R2 is what makes the row describe reality
 * instead of describing a moment that has passed, and it is what lets a
 * `PutObject` event for an object that no longer exists correctly delete the row
 * instead of resurrecting it.
 *
 * Cost: Queues includes 1,000,000 operations a month and delivery is 3
 * operations per message, so the first billable operation arrives at roughly
 * 333,000 media writes a month. It never enters the bill at this volume.
 */

/**
 * The one thing this consumer needs out of a notification.
 *
 * Read defensively rather than typed as a contract. A queue message is external
 * input: it crosses a process boundary, it may have been produced by a version
 * of R2's notification format this code has never seen, and it may simply be
 * malformed. Declaring `MessageBatch<R2Event>` would assert a shape nothing
 * verified, so the key is NARROWED out of `unknown` instead and anything that
 * fails to yield one is handled as a bad message rather than crashing the batch.
 */
function objectKeyOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const object = (body as { object?: unknown }).object;
  if (typeof object !== "object" || object === null) return null;
  const key = (object as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/*
 * `bucketFor` MOVED to `classify.mjs`, and the history is why it must be one
 * function rather than three that happen to agree.
 *
 * **This must ask, not assume, and the reason is a real defect it once caused.**
 * Until 2026-08-02 `indexOne` read `env.MEDIA` unconditionally while deriving
 * `storage` from `storageOf(key)` four lines later, so the consumer knew the key
 * belonged to OG and read the other bucket anyway. Because a missing object is
 * treated as a deletion, an OG-key event did not merely fail to index: it
 * DELETED the row.
 *
 * It was latent only because the notification rule was configured on
 * `dustinedwards-media` alone, which is safety by dashboard configuration rather
 * than by code. Adding notifications on OG, the obvious next step, would have had
 * every `build:og --remote` run silently strip the index. Since 2026-08-04 both
 * buckets DO notify this queue, so that safety margin is gone and the rule has to
 * hold in code.
 *
 * The asymmetry was invisible from inside: `rebuild.server.ts` already walked
 * both buckets correctly, and each file read correctly on its own. It took an
 * outside reader comparing the two. That is exactly the review this repo cannot
 * rely on, so the copies were collapsed into one and `check:invariants` now fails
 * if a second appears anywhere.
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
      // RETRY, explicitly. A transient D1 or R2 failure must not be acked, or
      // the row silently never appears and only check:media would ever notice.
      // After the configured attempts the platform moves it to the DLQ.
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
 * Deliberately not branching on the action. A `PutObject` for something already
 * deleted and a `DeleteObject` for something already replaced are both handled
 * correctly by asking R2 what is true now, and that is what makes out-of-order
 * delivery safe. Branching on the action would make the answer depend on message
 * ordering, which Queues does not promise.
 *
 * A `static` key can never arrive here: those objects are not in any bucket and
 * emit no notifications. `bucketFor` sends them to MEDIA, where the miss deletes
 * a row that a rebuild would immediately restore, so the failure is loud in
 * check:media rather than silent. If static keys ever DO reach this path, that
 * is the bug to fix, not this line.
 */
async function indexOne(env: Env, key: string) {
  const object = await bucketFor(env, key).get(key);

  if (!object) {
    // R2 WINS. The object is gone, so the row goes. Never the reverse: nothing
    // in this file writes to the bucket, and there is no import that could.
    //
    // LOGGED, because this branch is indistinguishable from the bug it hides.
    // A genuine delete and a key the consumer looked for in the wrong place, or
    // under the wrong encoding, both land here and both ack silently. That is
    // exactly how A004 stayed invisible: the symptom of reading the wrong bucket
    // was a row quietly not appearing.
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
  if (isRaster(key)) {
    try {
      const info = await env.IMAGES.info(object.body);
      if ("width" in info && "height" in info) {
        width = info.width;
        height = info.height;
      }
    } catch {
      // An unreadable image still gets a row. Dimensions are an enhancement and
      // NULL already means "not measured" in this schema; refusing the row
      // outright would make the index disagree with the bucket, which is the one
      // thing it may never do.
    }
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
    // Read off the OBJECT, so this path no longer depends on the upload route's
    // D1 write having succeeded. That write is non-fatal by design, and a
    // content-addressed key cannot yield a filename, so before this the name
    // had one source that was allowed to fail. Null for anything uploaded
    // without it, which `upsertDerivedMedia` treats as "do not touch".
    originalName: object.customMetadata?.originalName ?? null,
    // The placeholder is NOT derived here. It needs a second read of the body
    // and this path runs on every write; the rebuild computes it in bulk, where
    // paying for it once per object is the right trade.
    uploadedAt:
      object.uploaded instanceof Date ? object.uploaded.toISOString() : String(object.uploaded ?? ""),
  });
}
