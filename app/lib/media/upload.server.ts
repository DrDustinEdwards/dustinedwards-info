import { prepareUpload, RefusedError, type MediaResize, type PreparedUpload } from "@dustinedwards/site-api";
import { fromHex } from "@dustinedwards/site-runtime/encoding";
import { upsertMediaRecord } from "~/db";
import { classify, contentKey, roleOf } from "./classify.mjs";
import { ALLOWED, DATA_TYPES, MAX_BYTES, validateUpload } from "./upload-contract.mjs";
import { errorMessage } from "~/lib/error-message.mjs";
import { IMMUTABLE_CACHE_CONTROL } from "~/lib/seo";

/**
 * What an upload shrinks to when it asks (Carrel's, unless it says `resize=no`): the longer edge kept, and the quality
 * it is encoded at. Wide enough that a phone photo (4032 pixels) keeps its size; a larger camera file is shrunk, its
 * original kept in the backup bucket and in the file's history.
 */
export const RESIZE: MediaResize = { maxEdge: 4096, quality: 85 };

// `type` is the caller's claim: checked against `ALLOWED` and the bytes' signature (site-api's prepareUpload).
type UploadInput = {
  bytes: Uint8Array;
  type: string;
  name: string;
  /** Shrink past RESIZE.maxEdge. */
  resize?: boolean;
  /** The hash of the bytes as sent, where the caller already has it. */
  sha256?: string;
};

type StoreUploadResult =
  | {
      ok: true;
      key: string;
      bytes: number;
      width: number | null;
      height: number | null;
      // False when the D1 row failed; the object is stored regardless.
      recorded: boolean;
      prepared: PreparedUpload;
    }
  | { ok: false; code: string; message: string; status: number };

// The coded refusals first, so an unsupported type never reaches Images and an oversized blob is never hashed. Then
// site-api's prepareUpload: the byte signature, the embedded metadata, HEIC to JPEG, the location out, the shrink,
// the size, the placeholder and the hash.
export async function storeUpload(env: Env, file: UploadInput): Promise<StoreUploadResult> {
  const refusal = validateUpload({ type: file.type, bytes: file.bytes });
  if (refusal) return { ok: false, ...refusal };

  let prepared: PreparedUpload;
  try {
    prepared = await prepareUpload(
      env.IMAGES,
      // prepareUpload reads neither alt nor changeId.
      { bytes: file.bytes, contentType: file.type, filename: file.name, resize: file.resize ?? false, sha256: file.sha256, alt: "", changeId: "" },
      { resize: RESIZE, limits: { maxBytes: MAX_BYTES, types: [...ALLOWED.keys()] } },
    );
  } catch (error) {
    if (!(error instanceof RefusedError)) throw error;
    return { ok: false, code: "content-mismatch", message: error.message, status: 415 };
  }

  // A throw, not a default extension: `"bin"` would store an object `classify()` throws on for every reader.
  const extension = ALLOWED.get(prepared.contentType);
  if (!extension) throw new Error(`storeUpload: prepareUpload answered "${prepared.contentType}", which is not in ALLOWED.`);

  // Every allowed type but a data file is a raster, so no size means Images did not answer: the key carries `-<w>x<h>`
  // and would be permanent and sizeless and never render. A data file (CSV) has no size and its key carries none.
  const data = DATA_TYPES.has(prepared.contentType);
  const dimensions = prepared.width && prepared.height ? { width: prepared.width, height: prepared.height } : null;
  if (!dimensions && !data) {
    console.error(JSON.stringify({ alert: "upload-unmeasurable", name: file.name }));
    return { ok: false, code: "images-unavailable", message: "Cloudflare Images could not measure the image. Nothing was stored; try again.", status: 503 };
  }
  // The key's name segment is a lossy slug, so the original name is also kept in customMetadata.
  const key = contentKey(fromHex(prepared.sha256), extension, dimensions, prepared.filename);

  // Idempotent: the key is a function of the bytes and the name, so there is no exists check.
  await env.MEDIA.put(key, prepared.bytes, {
    httpMetadata: {
      contentType: prepared.contentType,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    },
    // On the object, not only the row: R2 is the truth and D1 must be re-derivable from it.
    customMetadata: { originalName: prepared.filename },
  });

  // Non-fatal: the object is already stored. `recorded: false` tells an HTTP caller the row did not land.
  let recorded = true;
  try {
    const { kind, mime } = classify(key);
    await upsertMediaRecord(env, {
      key,
      alt: "",
      storage: "r2",
      kind,
      role: roleOf(key),
      mime,
      bytes: prepared.bytes.byteLength,
      originalName: prepared.filename,
      uploadedAt: new Date().toISOString(),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      sha256: prepared.sha256,
      placeholder: prepared.placeholder,
    });
  } catch (error) {
    recorded = false;
    console.error(JSON.stringify({ alert: "media-record-write-failed", detail: errorMessage(error) }));
  }

  return { ok: true, key, bytes: prepared.bytes.byteLength, width: dimensions?.width ?? null, height: dimensions?.height ?? null, recorded, prepared };
}
