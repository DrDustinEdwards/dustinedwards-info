/**
 * MEDIA CORE. R2 listing, upload, thumbnails, metadata and delete mechanics.
 *
 * Shape 1 of media-module-architecture.md: this module knows nothing about what
 * cites an object. Content-agnostic BY CONSTRUCTION, not by convention, which
 * in practice means there is no import of anything post-shaped anywhere in this
 * file and no parameter that could carry one. "Who cites this key?" is asked
 * through the resolver seam in `resolvers.server.ts`, and the answer arrives as
 * data the core never inspects.
 *
 * That is the property that lets an album or a portfolio type register later
 * without this file changing.
 */

/** One page. Small enough to be a page rather than a dump of the bucket. */
export const MEDIA_PAGE_SIZE = 24;

/** Where the uploader writes, and therefore the only prefix the library lists. */
const PREFIX = "posts/";

/**
 * Widths the thumbnail route will honour.
 *
 * A closed set, because the width lands in a cache key and an open one lets any
 * caller mint unlimited distinct transforms of the same object, each of which
 * is a billed unique transformation. Three sizes cover the grid thumbnail, the
 * picker tile and a 2x display of either.
 */
export const THUMB_WIDTHS = [160, 320, 640] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

export type MediaObject = {
  key: string;
  url: string;
  size: number;
  uploaded: string;
};

export type MediaPage = {
  objects: MediaObject[];
  /** Opaque R2 cursor for the next page, or null when this is the last one. */
  cursor: string | null;
  truncated: boolean;
};

/**
 * The URL that renders this object at a thumbnail width.
 *
 * URL-DERIVED, per ruling 3: the width is in the URL, the transform happens on
 * request from the single original in R2, and no variant is ever written back.
 * One object, every size derived from it.
 */
export function thumbUrl(key: string, width: ThumbWidth) {
  return `/media/${key}?w=${width}`;
}

/**
 * Lists one page of the bucket, newest first.
 *
 * **Newest-first is per page, and that is a real limitation rather than an
 * oversight.** R2 paginates in KEY order, so a cursor walks the bucket
 * alphabetically and this can only sort the page it was handed. Keys begin
 * `posts/<year>/`, so key order is roughly chronological and the ordering is
 * exact within a page and approximately right across them. Sorting the whole
 * bucket would mean listing all of it on every request, which is the dump
 * pagination exists to avoid.
 */
export async function listMedia(
  env: Env,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<MediaPage> {
  const listed = await env.MEDIA.list({
    prefix: PREFIX,
    limit: options.limit ?? MEDIA_PAGE_SIZE,
    ...(options.cursor ? { cursor: options.cursor } : {}),
  });

  const objects = listed.objects
    .map((object) => ({
      key: object.key,
      url: `/media/${object.key}`,
      size: object.size,
      uploaded:
        object.uploaded instanceof Date
          ? object.uploaded.toISOString()
          : String(object.uploaded ?? ""),
    }))
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded));

  return {
    objects,
    // Returned rather than swallowed, the same rule the Ask prune learned the
    // hard way: a lister that silently shows page one is indistinguishable from
    // a bucket that has only one page in it.
    cursor: listed.truncated ? ((listed as { cursor?: string }).cursor ?? null) : null,
    truncated: listed.truncated,
  };
}

/** Intrinsic dimensions, read from the bytes rather than trusted from a client. */
export async function readDimensions(
  env: Env,
  key: string,
): Promise<{ width: number; height: number } | null> {
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  try {
    const info = await env.IMAGES.info(object.body);
    // `info` is a union: an SVG reports no pixel dimensions, because it has
    // none. Recording 0 would be a measurement; recording nothing is the truth.
    if ("width" in info && "height" in info) {
      return { width: info.width, height: info.height };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deletes one object. MECHANICS ONLY.
 *
 * There is deliberately no reference check in here. This module cannot see
 * citations and must not appear to: a `deleteMedia` that sometimes refused
 * would invite a caller to treat it as the safety, and the safety belongs in
 * the action where the resolver's answer is available and where failing closed
 * can be enforced. This function does what its name says and nothing else.
 */
export async function deleteMediaObject(env: Env, key: string) {
  await env.MEDIA.delete(key);
}

/** True when the key is one this module is willing to touch. */
export function isManagedKey(key: string) {
  // Anchored to the prefix the uploader writes, so a crafted key can never
  // reach `og/` cards or anything else that is not the library's to manage.
  return key.startsWith(PREFIX) && !key.includes("..");
}
