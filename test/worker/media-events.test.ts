import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { mediaRecord, upsertMediaRecord } from "~/db";
import { contentKey } from "~/lib/media/classify.mjs";
import { handleMediaEvents } from "../../workers/media-events";

/* An absent placeholder must never be written as NULL over one a bulk pass derived, and nothing
 * in the consumer mentions the column. `IMAGES` has no local emulation, so each case hands it a
 * RECORDED shape; `MEDIA_BACKUP` is absent, so the mirror step fails as it does in production. */

/** Distinct bytes per case, so distinct content-addressed keys. */
function bytesFor(seed: string) {
  return new TextEncoder().encode(`fake-image-bytes:${seed}`);
}

const PLACEHOLDER_BODY = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const PLACEHOLDER_URI = `data:image/webp;base64,${btoa("RIFF")}`;

/* `encodes: false` is the unreadable-source case: an SVG, a PDF or a corrupt upload makes
 * `placeholderFor` return null rather than throw. */
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

    const row = await mediaRecord(env as unknown as Parameters<typeof mediaRecord>[0], key);
    expect(acked).toEqual(["ack"]);
    expect(row, "the consumer wrote no row at all").not.toBeNull();
    expect(row?.width).toBe(800);

    expect(row?.placeholder).toBe(PLACEHOLDER_URI);
  });

  it("NEVER WRITES NULL OVER A STORED PLACEHOLDER when it cannot derive one", async () => {
    /* The row carries a placeholder from a bulk rebuild and the transformer cannot read the
     * source: the upsert must not write NULL over it. */
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

describe("the queue consumer and a failed Images read", () => {
  it("KEEPS THE STORED SIZES and asks for a retry instead of acking", async () => {
    const key = await seedObject("images-outage");
    const db = env as unknown as Parameters<typeof mediaRecord>[0];
    await handleMediaEvents(batchFor(key).batch, envWithImages({ width: 800, height: 600 }, true));
    expect((await mediaRecord(db, key))?.width, "the seed did not measure").toBe(800);

    const measuring = envWithImages(null, true) as unknown as { IMAGES: object };
    const failing = {
      ...env,
      IMAGES: {
        ...measuring.IMAGES,
        info: async () => {
          throw new Error("planted Images outage");
        },
      },
    } as unknown as Parameters<typeof handleMediaEvents>[1];
    const { batch, acked } = batchFor(key);
    await handleMediaEvents(batch, failing);

    const row = await mediaRecord(db, key);
    expect(acked).toEqual(["retry"]);
    expect(row?.width).toBe(800);
    expect(row?.height).toBe(600);
  });
});
