import { env } from "cloudflare:test";

import { contentKey } from "~/lib/media/classify.mjs";

/**
 * Media objects and the `IMAGES` binding for the media cases. The pool shares one D1 and R2
 * across cases, so each case names its own seed and gets its own bytes, and so its own key.
 */

type Dimensions = { width: number; height: number } | null;

/** Distinct bytes per seed, so distinct content-addressed keys. */
export function bytesFor(seed: string) {
  return new TextEncoder().encode(`fake-image-bytes:${seed}`);
}

/** The content-addressed PNG key `bytesFor(seed)` would be stored under at `dimensions`. */
export async function pngKey(seed: string, dimensions: Dimensions) {
  return contentKey(await crypto.subtle.digest("SHA-256", bytesFor(seed)), "png", dimensions);
}

/** What the recorded transformer encodes: the four bytes of a RIFF header. */
export const PLACEHOLDER_BODY = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

/**
 * The env with an `IMAGES` binding of a recorded shape, since it has no local emulation.
 * `dimensions` null models an SVG: the real binding answers with no `width`. Pass `encodes` to
 * give it a transformer too, false being the unreadable source (an SVG, a PDF, a corrupt upload)
 * that makes `placeholderFor` return null rather than throw. Without it there is no transformer.
 */
export function envWithImages(dimensions: Dimensions, encodes?: boolean) {
  return {
    ...env,
    IMAGES: {
      info: async (stream: ReadableStream) => {
        /* Drained, because the real binding consumes the stream. */
        await new Response(stream).arrayBuffer();
        return dimensions ?? { format: "image/svg+xml" };
      },
      ...(encodes === undefined
        ? {}
        : {
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
          }),
    },
  } as unknown as typeof env;
}
