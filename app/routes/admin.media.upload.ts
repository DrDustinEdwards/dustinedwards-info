import { upsertMediaRecord } from "~/db";
import { getEnv } from "~/lib/context";
import { readDimensions } from "~/lib/media/core.server";
import type { Route } from "./+types/admin.media.upload";

/**
 * Image upload for the editor. Sits under /admin so the existing Better Auth
 * middleware gates it; there is no unauthenticated write path to the bucket.
 *
 * Objects are keyed by year and a random suffix so a re-upload of the same
 * filename never overwrites an image an older post still references. Keys are
 * immutable once written, which is what lets /media/* serve them with a long
 * immutable cache.
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

function slugifyName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image"
  );
}

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

  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomUUID().slice(0, 8);
  const key = `posts/${year}/${slugifyName(file.name)}-${suffix}.${extension}`;

  await env.MEDIA.put(key, await file.arrayBuffer(), {
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
    await upsertMediaRecord(env, {
      r2Key: key,
      alt: "",
      uploaded: new Date().toISOString(),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    });
  } catch (error) {
    console.error("media record write failed after upload", error);
  }

  return Response.json({ url: `/media/${key}`, key });
}
