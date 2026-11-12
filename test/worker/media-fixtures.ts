import { env } from "cloudflare:test";

import { contentKey } from "~/lib/media/classify.mjs";

/**
 * Media objects and the `IMAGES` binding for the media cases. The pool shares one D1 and R2
 * across cases, so each case names its own seed and gets its own bytes, and so its own key.
 */

type Dimensions = { width: number; height: number } | null;

/** A PNG's signature, which an upload's bytes must begin with (site-api's prepareUpload). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Distinct bytes per seed, so distinct content-addressed keys; signed as a PNG. */
export function bytesFor(seed: string) {
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...new TextEncoder().encode(`fake-image-bytes:${seed}`),
  ]);
}

/** The content-addressed PNG key `bytesFor(seed)` would be stored under at `dimensions`. */
export async function pngKey(seed: string, dimensions: Dimensions) {
  return contentKey(await crypto.subtle.digest("SHA-256", bytesFor(seed)), "png", dimensions);
}

/**
 * The env with an `IMAGES` binding of a recorded shape, since it has no local emulation. `dimensions` null models an
 * SVG: the real binding answers with no `width`. It has no transformer, so an upload derives no placeholder.
 */
export function envWithImages(dimensions: Dimensions) {
  return {
    ...env,
    IMAGES: {
      info: async (stream: ReadableStream) => {
        /* Drained, because the real binding consumes the stream. */
        await new Response(stream).arrayBuffer();
        return dimensions ?? { format: "image/svg+xml" };
      },
    },
  } as unknown as typeof env;
}

/**
 * An upload's index row as the library reads it, written straight to D1 so a case can start from any state. Only the
 * columns a case names besides the key are set; the schema's defaults fill the rest.
 */
export async function seedMediaRow(
  key: string,
  columns: Record<string, string | number | null> = {},
) {
  const row = {
    content_type: "image/png",
    bytes: 1,
    sha256: "",
    uploaded_at: "2026-01-01T00:00:00.000Z",
    ...columns,
  };
  const names = Object.keys(row);
  await env.DB.prepare(
    `INSERT INTO media (key, ${names.join(", ")}) VALUES (?, ${names.map(() => "?").join(", ")})`,
  )
    .bind(key, ...Object.values(row))
    .run();
}
