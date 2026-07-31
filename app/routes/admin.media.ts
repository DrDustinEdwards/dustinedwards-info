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

/**
 * What is already in the bucket, for the cover picker in the editor's settings
 * drawer.
 *
 * A READ, deliberately added alongside the upload rather than as a route of its
 * own: the two are the same resource and the same authorization, and splitting
 * them would mean a second path to keep gated. The redesign ruling allows this
 * (a read-only route is not a new write path) and the upload action below is
 * untouched.
 *
 * The `posts/` prefix is the only place the uploader writes, so listing it
 * cannot surface anything the editor did not put there. `truncated` is returned
 * rather than swallowed, because a picker that silently shows the first page of
 * a longer list is the same class of bug as the Ask prune that reported
 * "removed 0" while reading only page one.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const listed = await env.MEDIA.list({ prefix: "posts/", limit: 200 });
  return {
    objects: listed.objects
      .map((object) => ({
        key: object.key,
        url: `/media/${object.key}`,
        size: object.size,
        uploaded:
          object.uploaded instanceof Date
            ? object.uploaded.toISOString()
            : String(object.uploaded ?? ""),
      }))
      // Newest first: the image you want is nearly always the one you just
      // uploaded.
      .sort((a, b) => b.uploaded.localeCompare(a.uploaded)),
    truncated: listed.truncated,
  };
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
