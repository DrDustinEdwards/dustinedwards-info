import { upsertMediaRecord } from "~/db";
import { classify, contentKey, roleOf } from "./classify.mjs";
import { measureDimensions } from "./core.server";
import { ALLOWED, validateUpload } from "./upload-contract.mjs";

/**
 * THE ONE DOOR TO THE MEDIA BUCKET, for bytes a person or an agent supplied.
 *
 * Everything an upload does after the bytes are in hand happens here and
 * nowhere else: refuse, measure, address, put, annotate. Two callers, both thin
 * adapters over this, on the same law the publish tools live under:
 *
 *   `admin.media.upload.ts`  a multipart form from the editors and the library
 *   `upload_media`           base64 or a URL, over the operator token
 *
 * ## WHY IT IS A MODULE AND NOT A SECOND COPY OF THE ROUTE
 *
 * The route's action WAS the upload, which was fine while it was the only
 * writer to MEDIA. Ruling 32d added a second one, and the sequence below is not
 * the kind a second copy stays equal to: the dimensions are measured before the
 * key exists because the key CARRIES them (finding B002), the filename is
 * written to the object's custom metadata as well as to D1, and the D1 write is
 * deliberately non-fatal. A copy that got any of those three wrong would look
 * correct and would produce objects the rebuild cannot fully re-derive.
 *
 * `savePost` is the precedent. The editor action is an adapter over it, the
 * operator's `save_post` is another, and there is one write path underneath.
 *
 * ## WHAT IT STILL DOES NOT OWN
 *
 * The `no-file` refusal, because each caller's missing input is a different
 * thing with a different repair, and the branch between a redirect and a JSON
 * body, because that is a property of who is asking. Both stay in the adapters.
 */

/**
 * The bytes and what the caller knows about them.
 *
 * `type` is the MIME the caller asserts. It is CHECKED against `ALLOWED` and
 * never sniffed: the form path takes it from the `File`, the operator path
 * takes it from a `data:` prefix, an explicit argument or the fetched
 * response's own `Content-Type`. All three are claims, and the allowlist is
 * what makes a wrong claim harmless rather than the claim being trusted.
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
   * Present by construction: `validateUpload` refused every type outside
   * ALLOWED one statement ago, and the two read the SAME map. The fallback is
   * unreachable and is written as a throw rather than a default extension,
   * because hard rule 13 says a fallback that substitutes a different value is
   * not failing closed, and `"bin"` here would put an unclassifiable object in
   * the bucket that `classify()` then throws on for every later reader.
   */
  const extension = ALLOWED.get(file.type);
  if (!extension) {
    throw new Error(
      `storeUpload: "${file.type}" passed validateUpload but is not in ALLOWED. ` +
        `The two have drifted; both are in upload-contract.mjs.`,
    );
  }

  /**
   * MEASURED BEFORE THE KEY EXISTS, because the key carries the measurement.
   *
   * Finding B002: image dimensions are baked into the gated HTML, and the two
   * writers measured them from two different stores, one of which a clone
   * cannot reach. The key carries `-<w>x<h>` so both resolvers parse rather
   * than fetch. That makes this measurement an input to the key, which is why
   * it happens here rather than by reading the object back after the put.
   *
   * Null is a real answer and not a failure: an SVG has no intrinsic pixel
   * size, so it gets a key with no dimension segment, exactly as the `media`
   * table records a NULL width for the same reason.
   */
  const dimensions = await measureDimensions(env, file.bytes);
  const key = contentKey(
    await crypto.subtle.digest("SHA-256", file.bytes),
    extension,
    dimensions,
  );

  // Unconditional, and idempotent BY CONSTRUCTION: the key is a function of the
  // bytes, so re-uploading the same image overwrites an object with a
  // byte-identical one. There is deliberately no "does it exist" check first,
  // which would cost a round trip to save a write that changes nothing.
  await env.MEDIA.put(key, file.bytes, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    // THE FILENAME LIVES ON THE OBJECT, not only in the row.
    //
    // A content-addressed key is a digest, so the name the author chose is not
    // recoverable from it and a rebuild cannot re-derive what only D1 held. The
    // D1 write below is deliberately non-fatal, and the queue consumer inserts
    // its own row from the event without one, so the name had exactly one
    // source and that source was allowed to fail silently.
    //
    // Custom metadata makes it a property of the OBJECT, which is the same rule
    // the whole module runs on: R2 is the truth, D1 is derived, and anything
    // derived must be re-derivable. Found by audit 2026-08-02.
    customMetadata: { originalName: file.name },
  });

  /**
   * The annotation row, created HERE rather than left to the backfill.
   *
   * The backfill exists for objects that predate the table; making it also the
   * only path that measures dimensions would mean every fresh upload showed no
   * dimensions in the library until someone remembered to run it, which is a
   * chore the system can do for itself. Alt starts empty, because nobody has
   * written one yet, and the library is where it gets filled in.
   *
   * Non-fatal, deliberately: the object is already in R2 and the upload has
   * succeeded, so a D1 hiccup must not report failure for a write that
   * happened. The library lists objects from the BUCKET and treats a missing
   * row as empty metadata, so the worst case is an un-annotated object and a
   * backfill button offering to fix it.
   *
   * REPORTED rather than only logged, since this became a door two callers
   * share. A console line is readable by whoever is tailing the Worker; an
   * operator calling this over HTTP is not, and `recorded: false` is what lets
   * it say "the object landed, the row did not, run sync_media" instead of
   * reporting an unqualified success it cannot see behind.
   */
  let recorded = true;
  try {
    // `dimensions` is the measurement the key was built from, reused rather
    // than re-read: one measurement means the row and the key cannot disagree,
    // and it drops a round trip back to R2 for bytes we just had in hand.
    const { kind, mime } = classify(key);
    await upsertMediaRecord(env, {
      key,
      alt: "",
      storage: "r2",
      kind,
      role: roleOf(key),
      mime,
      bytes: file.bytes.byteLength,
      // The ONLY surviving copy of what the author called this file. The key
      // cannot carry it any more, so losing this loses it outright.
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
