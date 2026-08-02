import { upsertMediaRecord } from "~/db";
import { getEnv } from "~/lib/context";
import { classify, contentKey, roleOf } from "~/lib/media/classify.mjs";
import { readDimensions } from "~/lib/media/core.server";
import type { Route } from "./+types/admin.media.upload";

/**
 * Image upload for the editor. Sits under /admin so the existing Better Auth
 * middleware gates it; there is no unauthenticated write path to the bucket.
 *
 * ## Keys are CONTENT-ADDRESSED
 *
 * Ruling: decisions.md 2026-08-02. `sha256(bytes)` truncated plus the extension,
 * replacing `posts/<year>/<slug>-<8hex>.<ext>`.
 *
 * **The security argument is what decided it.** `/media/*` is public and
 * unauthenticated, and the old key was derivable from public information: a
 * draft post's images were reachable by anyone who guessed a slug the sitemap
 * publishes plus eight hex characters. A content-addressed key is not derivable
 * from anything public, because it is a function of bytes nobody outside has.
 *
 * Secondary, all real: the same photo uploaded twice is now ONE object rather
 * than two; immutability stops being a convention the uploader maintains and
 * becomes arithmetic, which is what makes the `immutable` cache header provably
 * safe rather than merely intended; and the key is VERIFIABLE against the bytes,
 * which nothing in the old scheme could be.
 *
 * The cost, taken knowingly: deduplication makes delete a REFCOUNT rather than
 * an object operation, because once two posts share a blob, deleting for one
 * must not delete for the other. `media_refs` is what will answer that.
 *
 * Human readability moved to `original_name`. The key is an address, not a
 * label, and the filename the author chose survives in D1 where it belongs.
 */

const ALLOWED = new Map([
  ["image/webp", "webp"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

const MAX_BYTES = 10 * 1024 * 1024;

/* `slugifyName` lived here to build the human-readable half of a key. Content
 * addressing removed the only caller: the key is a digest now, and the filename
 * goes to `original_name` verbatim rather than being mangled into a slug. */

/**
 * The listing loader that used to live here MOVED to the media page at
 * /admin/media, so there is one lister and one media surface. This route is now
 * the upload endpoint only, which is why it kept the action and lost the
 * loader. Its URL changed from /admin/media to /admin/media/upload; the editor
 * and the picker both post to the new one.
 */

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file was submitted." }, { status: 400 });
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    return Response.json(
      { error: `Unsupported image type "${file.type || "unknown"}".` },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `Image is ${Math.round(file.size / 1024)} kB, over the 10 MB limit.` },
      { status: 413 },
    );
  }

  // Read once. The bytes are needed twice, to hash and to store, and a File's
  // stream cannot be consumed twice.
  const bytes = await file.arrayBuffer();
  const key = contentKey(await crypto.subtle.digest("SHA-256", bytes), extension);

  // Unconditional, and idempotent BY CONSTRUCTION: the key is a function of the
  // bytes, so re-uploading the same image overwrites an object with a
  // byte-identical one. There is deliberately no "does it exist" check first,
  // which would cost a round trip to save a write that changes nothing.
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
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
   */
  try {
    const dimensions = await readDimensions(env, key);
    const { kind, mime } = classify(key);
    await upsertMediaRecord(env, {
      key,
      alt: "",
      storage: "r2",
      kind,
      role: roleOf(key),
      mime,
      bytes: bytes.byteLength,
      // The ONLY surviving copy of what the author called this file. The key
      // cannot carry it any more, so losing this loses it outright.
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    });
  } catch (error) {
    console.error("media record write failed after upload", error);
  }

  return Response.json({ url: `/media/${key}`, key });
}
