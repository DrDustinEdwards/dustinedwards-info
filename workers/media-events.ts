import { deleteSiteAsset, upsertSiteAsset } from "~/db";
import { classify, isRaster, roleOf, storageOf } from "~/lib/media/classify.mjs";
import { measureDimensions } from "~/lib/media/core.server";
import { errorMessage } from "@dustinedwards/site-runtime/log";

/**
 * The writer of the site file index's OG rows (site_assets), fed by R2 event notifications rather than a dual write.
 * Must be idempotent: Queues delivers at least once and out of order, so the object is re-read, never trusted from the
 * event, and R2 wins any disagreement. An event for MEDIA, the library's bucket, writes nothing: site-api's
 * mediaLibrary writes the library's rows as it stores the bytes (app/db/media.ts).
 */

function objectKeyOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const object = (body as { object?: unknown }).object;
  if (typeof object !== "object" || object === null) return null;
  const key = (object as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}


export async function handleMediaEvents(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    const key = objectKeyOf(message.body);
    if (!key) {
      console.error(JSON.stringify({ alert: "media-event-no-object-key", body: message.body }));
      message.ack();
      continue;
    }

    try {
      await indexOne(env, key);
      message.ack();
    } catch (error) {
      // Never ack a transient failure, or the row silently never appears.
      console.error(
        JSON.stringify({ alert: "media-event-failed", key, detail: errorMessage(error) }),
      );
      message.retry();
    }
  }
}

/** Ignores the event's action on purpose: asking R2 what is true now makes reordering safe. */
async function indexOne(env: Env, key: string) {
  // Only OG's keys are the index's (classify.mjs storageOf), and OG's events and MEDIA's share the queue.
  if (storageOf(key) !== "r2-derived") return;
  const object = await env.OG.get(key);

  if (!object) {
    console.log(JSON.stringify({ event: "media-event-no-object", key, action: "deleting any row" }));
    await deleteSiteAsset(env, key);
    return;
  }

  const { kind, mime } = classify(key);

  let width: number | null = null;
  let height: number | null = null;
  // An unreadable image still gets a row, or the index would disagree with the bucket; the stored
  // sizes are left alone and the failure is thrown after the write, so the message retries and a
  // permanent failure lands in the dead-letter queue.
  let measureFailure: unknown = null;
  if (isRaster(key)) {
    try {
      const dimensions = await measureDimensions(env, object.body);
      width = dimensions?.width ?? null;
      height = dimensions?.height ?? null;
    } catch (error) {
      measureFailure = error;
    }
  }

  await upsertSiteAsset(env, {
    key,
    storage: storageOf(key),
    kind,
    role: roleOf(key),
    mime,
    bytes: object.size,
    width,
    height,
    uploadedAt:
      object.uploaded instanceof Date
        ? object.uploaded.toISOString()
        : String(object.uploaded ?? ""),
  });

  // Last, so the row is written before the retry is asked for.
  if (measureFailure) throw measureFailure;
}
