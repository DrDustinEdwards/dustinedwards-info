import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { handleMediaEvents } from "../../workers/media-events";

import { bytesFor, envWithImages, pngKey } from "./media-fixtures";

/* The consumer keeps the site file index (site_assets) in step with OG, and leaves MEDIA's keys to the library.
 * `IMAGES` has no local emulation, so each case hands it a RECORDED shape. */

const consumerEnv = (dimensions: { width: number; height: number } | null) =>
  envWithImages(dimensions) as unknown as Parameters<typeof handleMediaEvents>[1];

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

const assetRow = (key: string) =>
  env.DB.prepare("SELECT storage, role, width, height FROM site_assets WHERE key = ?1")
    .bind(key)
    .first<{ storage: string; role: string; width: number | null; height: number | null }>();

async function seedCard(seed: string) {
  const key = `og/dustin-edwards-${seed}-0123abcd.png`;
  await env.OG.put(key, bytesFor(seed));
  return key;
}

describe("the queue consumer", () => {
  it("indexes a generated OG object, and drops its row once the object is gone", async () => {
    const key = await seedCard("indexed");
    const put = batchFor(key);
    await handleMediaEvents(put.batch, consumerEnv({ width: 1200, height: 630 }));
    expect(put.acked).toEqual(["ack"]);
    expect(await assetRow(key)).toEqual({
      storage: "r2-derived",
      role: "generated",
      width: 1200,
      height: 630,
    });

    await env.OG.delete(key);
    const gone = batchFor(key);
    await handleMediaEvents(gone.batch, consumerEnv(null));
    expect(gone.acked).toEqual(["ack"]);
    expect(await assetRow(key)).toBeNull();
  });

  it("WRITES NOTHING for a MEDIA upload, whose row is the library's", async () => {
    const key = await pngKey("library-upload", { width: 800, height: 600 });
    await env.MEDIA.put(key, bytesFor("library-upload"));
    const { batch, acked } = batchFor(key);
    await handleMediaEvents(batch, consumerEnv({ width: 800, height: 600 }));
    expect(acked).toEqual(["ack"]);
    expect(await assetRow(key)).toBeNull();
    expect(await env.DB.prepare("SELECT key FROM media WHERE key = ?1").bind(key).first()).toBeNull();
  });
});

describe("the queue consumer and a failed Images read", () => {
  it("KEEPS THE STORED SIZES and asks for a retry instead of acking", async () => {
    const key = await seedCard("images-outage");
    await handleMediaEvents(batchFor(key).batch, consumerEnv({ width: 1200, height: 630 }));
    expect((await assetRow(key))?.width, "the seed did not measure").toBe(1200);

    const failing = {
      ...env,
      IMAGES: {
        info: async () => {
          throw new Error("planted Images outage");
        },
      },
    } as unknown as Parameters<typeof handleMediaEvents>[1];
    const { batch, acked } = batchFor(key);
    await handleMediaEvents(batch, failing);

    expect(acked).toEqual(["retry"]);
    expect(await assetRow(key)).toMatchObject({ width: 1200, height: 630 });
  });
});
