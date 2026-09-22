import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { mediaRecord, upsertMediaRecord } from "~/db";
import { contentKey } from "~/lib/media/classify.mjs";
import { handleMediaEvents } from "../../workers/media-events";

/**
 * The queue consumer and the placeholder column.
 *
 * ## THE DEFECT THESE REPLAY
 *
 * Two halves, either sufficient on its own to leave every uploaded image with
 * no placeholder for ever:
 *
 *   1. `indexOne` derived no placeholder, on the reasoning that the bulk
 *      rebuild would. So an editor upload had none until somebody pressed a
 *      button by hand.
 *   2. `upsertDerivedMedia` turned the absent value into NULL and wrote it over
 *      whatever the last bulk pass HAD derived. The deferral did not postpone
 *      the work, it destroyed the result of work already done, and every R2
 *      event re-destroyed it.
 *
 * Half 2 is the one worth a test in its own right, because it is invisible in
 * every reading of the consumer: nothing there mentions the column at all.
 *
 * ## OBSERVATION BOUNDARY
 *
 * R2 and D1 are the real miniflare-local stores. `IMAGES` is NOT: it is a
 * platform binding with no local emulation, so every case here hands the
 * consumer a binding with a RECORDED shape and says which. What is under test
 * is what the consumer DOES with a measurement, never the measuring.
 *
 * `MEDIA_BACKUP` is deliberately absent from the test bindings, so the mirror
 * step fails and is swallowed exactly as it is in production. That is the
 * behavior under test elsewhere; here it only has to not take the row with it.
 */

/** Distinct bytes per case, so distinct content-addressed keys. */
function bytesFor(seed: string) {
  return new TextEncoder().encode(`fake-image-bytes:${seed}`);
}

/** The recorded placeholder payload: four bytes standing in for a WebP body. */
const PLACEHOLDER_BODY = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const PLACEHOLDER_URI = `data:image/webp;base64,${btoa("RIFF")}`;

/**
 * An env whose IMAGES binding reports `dimensions` and either encodes a
 * placeholder or refuses to.
 *
 * `encodes: false` is the unreadable-source case, which is a real one: an SVG,
 * a PDF or a corrupt upload reaches `placeholderFor` and it returns null rather
 * than throwing.
 */
function envWithImages(
  dimensions: { width: number; height: number } | null,
  encodes: boolean,
) {
  return {
    ...env,
    IMAGES: {
      info: async (stream: ReadableStream) => {
        await new Response(stream).arrayBuffer();
        return dimensions ?? { format: "image/svg+xml" };
      },
      input: (stream: ReadableStream) => ({
        transform: () => ({
          output: async () => {
            /* Drained, because the real binding consumes the stream and a case
             * that left it open would not be exercising the same call. */
            await new Response(stream).arrayBuffer();
            if (!encodes) throw new Error("the transformer could not read this source");
            return { response: () => new Response(PLACEHOLDER_BODY) };
          },
        }),
      }),
    },
  } as unknown as Parameters<typeof handleMediaEvents>[1];
}

/** One `PutObject` notification, in the shape R2 actually sends. */
function batchFor(key: string) {
  const acked: string[] = [];
  const batch = {
    messages: [
      {
        body: { action: "PutObject", object: { key } },
        ack: () => acked.push("ack"),
        retry: () => acked.push("retry"),
      },
    ],
  } as unknown as Parameters<typeof handleMediaEvents>[0];
  return { batch, acked };
}

async function seedObject(seed: string) {
  const bytes = bytesFor(seed);
  const key = contentKey(await crypto.subtle.digest("SHA-256", bytes), "png", {
    width: 800,
    height: 600,
  });
  await env.MEDIA.put(key, bytes);
  return key;
}

describe("the queue consumer derives the placeholder", () => {
  it("writes one from the object the event names, with no rebuild", async () => {
    const key = await seedObject("derives");
    const { batch, acked } = batchFor(key);

    await handleMediaEvents(batch, envWithImages({ width: 800, height: 600 }, true));

    // CONTROL. Without this every assertion below could pass by examining
    // nothing: a consumer that never wrote a row has no wrong column to find.
    const row = await mediaRecord(env as unknown as Parameters<typeof mediaRecord>[0], key);
    expect(acked).toEqual(["ack"]);
    expect(row, "the consumer wrote no row at all").not.toBeNull();
    expect(row?.width).toBe(800);

    expect(row?.placeholder).toBe(PLACEHOLDER_URI);
  });

  it("NEVER WRITES NULL OVER A STORED PLACEHOLDER when it cannot derive one", async () => {
    /*
     * The erase, replayed. The row already carries a placeholder (this is what
     * a bulk rebuild leaves behind), the event arrives, and the transformer
     * cannot read the source. Before the fix the upsert wrote NULL here and the
     * only way back was another bulk pass.
     */
    const key = await seedObject("preserves");
    await upsertMediaRecord(env as unknown as Parameters<typeof upsertMediaRecord>[0], {
      key,
      storage: "r2",
      kind: "image",
      role: "content",
    });
    const db = env as unknown as Parameters<typeof mediaRecord>[0];
    await env.DB.prepare("UPDATE media SET placeholder = ?1 WHERE key = ?2")
      .bind("data:image/webp;base64,PRIOR", key)
      .run();
    expect((await mediaRecord(db, key))?.placeholder, "the seed did not apply").toBe(
      "data:image/webp;base64,PRIOR",
    );

    const { batch, acked } = batchFor(key);
    await handleMediaEvents(batch, envWithImages({ width: 800, height: 600 }, false));

    const row = await mediaRecord(db, key);
    expect(acked).toEqual(["ack"]);
    // The rest of the row IS re-derived, which is what makes the preserved
    // column a decision rather than a write that did not happen.
    expect(row?.width).toBe(800);
    expect(row?.placeholder).toBe("data:image/webp;base64,PRIOR");
  });
});
