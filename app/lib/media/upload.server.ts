import { upsertMediaRecord } from "~/db";
import { classify, contentKey, roleOf } from "./classify.mjs";
import { measureDimensions } from "./core.server";
import { ALLOWED, validateUpload } from "./upload-contract.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

// `type` is the caller's claim: checked against `ALLOWED`, never sniffed.
type UploadInput = {
  bytes: ArrayBuffer;
  type: string;
  name: string;
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
    }
  | { ok: false; code: string; message: string; status: number };

// Refuses before measuring, so an unsupported type never reaches Images and an oversized blob is never hashed.
export async function storeUpload(env: Env, file: UploadInput): Promise<StoreUploadResult> {
  const refusal = validateUpload({ type: file.type, bytes: file.bytes });
  if (refusal) return { ok: false, ...refusal };

  // A throw, not a default extension: `"bin"` would store an object `classify()` throws on for every reader.
  const extension = ALLOWED.get(file.type);
  if (!extension) {
    throw new Error(
      `storeUpload: "${file.type}" passed validateUpload but is not in ALLOWED. ` +
        `The two have drifted; both are in upload-contract.mjs.`,
    );
  }

  // Measured before the key exists, because the key carries `-<w>x<h>`. Null (an SVG) is a real answer;
  // a failed measurement refuses, since the key would be permanent and sizeless and never render.
  let dimensions: { width: number; height: number } | null;
  try {
    dimensions = await measureDimensions(env, file.bytes);
  } catch (error) {
    console.error("upload refused: the image could not be measured", error);
    return {
      ok: false,
      code: "images-unavailable",
      message: `${errorMessage(error)}. Nothing was stored; try again.`,
      status: 503,
    };
  }
  // The key's name segment is a lossy slug, so the original name is also kept in customMetadata.
  const key = contentKey(
    await crypto.subtle.digest("SHA-256", file.bytes),
    extension,
    dimensions,
    file.name,
  );

  // Idempotent: the key is a function of the bytes and the name, so there is no exists check.
  await env.MEDIA.put(key, file.bytes, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    // On the object, not only the row: R2 is the truth and D1 must be re-derivable from it.
    customMetadata: { originalName: file.name },
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
      bytes: file.bytes.byteLength,
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
