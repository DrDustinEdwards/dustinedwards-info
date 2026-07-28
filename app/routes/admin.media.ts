import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.media";

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

  return Response.json({ url: `/media/${key}`, key });
}
