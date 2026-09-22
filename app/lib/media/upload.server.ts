import { upsertMediaRecord } from "~/db";
import { classify, contentKey, roleOf } from "./classify.mjs";
import { measureDimensions } from "./core.server";
import { ALLOWED, validateUpload } from "./upload-contract.mjs";

/**
 * THE ONE DOOR TO THE MEDIA BUCKET, for bytes a person or an agent supplied.
 *
 * Everything an upload does after the bytes are in hand happens here and nowhere else: refuse,
 * measure, address, put, annotate. Two thin adapters call it on the same law the publish tools live
 * under, `admin.media.upload.ts` with a multipart form and `upload_media` over the operator token.
 *
 * WHAT IT STILL DOES NOT OWN: the `no-file` refusal, because each caller's missing input has a
 * different repair, and the branch between a redirect and a JSON body, because that is a property of
 * who is asking. Both stay in the adapters.
 */

/**
 * The bytes and what the caller knows about them.
 *
 * `type` is the MIME the caller ASSERTS. It is CHECKED against `ALLOWED` and never sniffed: every
 * path's type is a claim, and the allowlist is what makes a wrong claim harmless rather than the
 * claim being trusted.
 */
export type UploadInput = {
  bytes: ArrayBuffer;
  type: string;
  /** What the author called the file. The only surviving copy; see below. */
  name: string;
};

export type StoreUploadResult =
  | {
      ok: true;
      key: string;
      bytes: number;
      width: number | null;
      height: number | null;
      /** False when the annotation row could not be written. The object stands. */
      recorded: boolean;
    }
  | { ok: false; code: string; message: string; status: number };

/**
 * Stores one upload, or refuses it.
 *
 * REFUSES BEFORE IT MEASURES, so an unsupported type never reaches the Images
 * binding and an oversized blob is never hashed. The refusal is
 * `validateUpload`'s, and it is called HERE rather than in the adapters so the
 * control sits with the writer rather than with whoever remembers to ask.
 */
export async function storeUpload(env: Env, file: UploadInput): Promise<StoreUploadResult> {
  const refusal = validateUpload({ type: file.type, bytes: file.bytes });
  if (refusal) return { ok: false, ...refusal };

  /*
   * Present by construction: `validateUpload` refused every type outside ALLOWED one statement ago,
   * and the two read the SAME map. Written as a throw rather than a default extension:
   * hard rule 13 says a fallback that substitutes a different value is not failing closed, and
   * `"bin"` would put an unclassifiable object in the bucket that `classify()` throws on for every
   * later reader.
   */
  const extension = ALLOWED.get(file.type);
  if (!extension) {
    throw new Error(
      `storeUpload: "${file.type}" passed validateUpload but is not in ALLOWED. ` +
        `The two have drifted; both are in upload-contract.mjs.`,
    );
  }

  /**
   * MEASURED BEFORE THE KEY EXISTS, because the key carries the measurement: it holds `-<w>x<h>` so
   * both resolvers parse rather than fetch, which makes this an input to the key rather than something
   * read back off the object.
   *
   * Null is a real answer and not a failure: an SVG has no intrinsic pixel size, so it gets a key with
   * no dimension segment, exactly as the `media` table records a NULL width.
   */
  const dimensions = await measureDimensions(env, file.bytes);
  /*
   * The author's filename is an INPUT to the key now (ruling 127): it supplies the descriptive
   * segment a reader sees on disk. It stays in customMetadata below as well, because the slug is
   * lossy and the original is what the library shows.
   */
  const key = contentKey(
    await crypto.subtle.digest("SHA-256", file.bytes),
    extension,
    dimensions,
    file.name,
  );

  // Unconditional, and idempotent BY CONSTRUCTION: the key is a function of the bytes and the name, so
  // re-uploading the same file overwrites an object with a byte-identical one. There is deliberately no
  // "does it exist" check first.
  await env.MEDIA.put(key, file.bytes, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    // THE FILENAME LIVES ON THE OBJECT, not only in the row. A content-addressed key is a digest, so the
    // name the author chose is not recoverable from it, and the D1 write below is deliberately non-fatal.
    //
    // Custom metadata makes it a property of the OBJECT, which is the rule the whole module runs on: R2
    // is the truth, D1 is derived, and anything derived must be re-derivable.
    customMetadata: { originalName: file.name },
  });

  /**
   * The annotation row, created HERE rather than left to the backfill, so a fresh upload shows its
   * dimensions in the library without anyone remembering to run one. Alt starts empty.
   *
   * NON-FATAL, deliberately: the object is already in R2 and the upload has succeeded, so a D1 hiccup
   * must not report failure for a write that happened. REPORTED rather than only logged, because an
   * operator calling this over HTTP cannot read a console line, and `recorded: false` is what lets it
   * say the object landed and the row did not.
   */
  let recorded = true;
  try {
    // `dimensions` is the measurement the key was built from, reused rather than re-read: one
    // measurement means the row and the key cannot disagree.
    const { kind, mime } = classify(key);
    await upsertMediaRecord(env, {
      key,
      alt: "",
      storage: "r2",
      kind,
      role: roleOf(key),
      mime,
      bytes: file.bytes.byteLength,
      // The ONLY exact copy of what the author called this file. The key
      // carries a lossy slug of it, so losing this loses the original.
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    });
  } catch (error) {
    recorded = false;
    console.error("media record write failed after upload", error);
  }

  return {
    ok: true,
    key,
    bytes: file.bytes.byteLength,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    recorded,
  };
}
