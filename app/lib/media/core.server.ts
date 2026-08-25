import { listMediaPage } from "~/db";

import { isContentKey } from "./classify.mjs";

/**
 * MEDIA CORE. Library listing, upload, thumbnails, metadata and delete mechanics.
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

/* DERIVED_PREFIX is GONE. It existed for `isManagedKey`, which excluded `og/`
 * keys by prefix beside its own copy of the key grammar. The grammar now has
 * one owner, `isContentKey` in classify.mjs, and its pattern admits no slash
 * and no non-hex lead, so an `og/` key fails the shape test itself and the
 * prefix check had nothing left to refuse. */

/**
 * Widths the thumbnail route will honour.
 *
 * A closed set, because the width lands in a cache key and an open one lets any
 * caller mint unlimited distinct transforms of the same object, each of which
 * is a billed unique transformation. Three sizes cover the grid thumbnail, the
 * picker tile and a 2x display of either.
 */
export type ThumbWidth = 160 | 320 | 640;

export type MediaObject = {
  key: string;
  url: string;
  size: number;
  uploaded: string;
  storage: string;
  kind: string;
  /** What the asset is FOR. The one badge the card shows. */
  role: string;
  mime: string | null;
  originalName: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  /** The delimited storage form. The route parses it; nothing else reads it raw. */
  tags: string;
  placeholder: string | null;
  /** False for a static asset, which is removed by a commit and not by the UI. */
  deletable: boolean;
};

export type MediaPage = {
  objects: MediaObject[];
  page: number;
  hasMore: boolean;
};

/**
 * The URL that renders this object at a thumbnail width.
 *
 * URL-DERIVED, per ruling 3: the width is in the URL, the transform happens on
 * request from the single original in R2, and no variant is ever written back.
 * One object, every size derived from it.
 */
export function thumbUrl(key: string, width: ThumbWidth) {
  // A STATIC asset is indexed under its own public path, which already begins
  // with `/`, so prefixing `/media/` yields `/media//publications/x.pdf` and the
  // R2 route 404s on it. That was every one of the 58 static rows, including all
  // nine roster photos: the grid rendered a broken image for the only pictures
  // the page exists to surface.
  //
  // A static asset is served by the assets host directly, so it needs no
  // transform URL and gets none. The cost is that it is delivered at full size
  // into a thumbnail box; these are small files and a correct image beats a
  // resized 404. Serving static transforms would mean teaching /media/* to read
  // through ASSETS, which is a route change rather than a UI one.
  if (key.startsWith("/")) return key;
  return `/media/${key}?w=${width}`;
}

/** True when there is an image to show at all. A PDF has no thumbnail. */
export function isViewable(kind: string) {
  return kind === "image";
}

/**
 * The listing axes, DERIVED from `listMediaPage` rather than restated here.
 *
 * Restating them is what broke `listMedia`. The options type named six of the
 * twelve axes `listMediaPage` implements, the loader passed all twelve through
 * an object SPREAD, and spreads are exempt from excess-property checking, so
 * `sort`, `dir`, `tag`, `lens`, `templateKeys` and `trashed` were accepted by
 * the compiler and dropped on the floor. Live effect, measured on production
 * 2026-08-16: `?sort=size` and `?sort=name&dir=asc` returned byte-identical
 * rows to the default, and `?trash=1` returned 24 NOT-trashed files while the
 * trash count beside it read 0.
 *
 * Deriving the type means a new axis on `listMediaPage` is covered here by
 * construction instead of by somebody remembering. `check:media-axes` asserts
 * both halves: that this stays derived, and that the forwarding stays a spread.
 */
type ListMediaOptions = NonNullable<Parameters<typeof listMediaPage>[1]>;

/**
 * Lists one page of the library FROM D1.
 *
 * **It no longer touches R2, and that is the point of the index.** Listing from
 * the bucket could only ever paginate in key order, which stopped meaning
 * anything the moment keys became content-addressed digests. Every question the
 * library actually asks (newest first, images only, which are documents, how
 * many of each) is a query, and none of them can be built on a key-ordered
 * iterator without listing the whole bucket per request.
 *
 * D1 is DERIVED, so this is reading a copy, and that is legitimate here for the
 * one reason the ruling turns on: the copy is exhaustively reconcilable against
 * its source, and `check:media` reconciles it in both directions on every run.
 * R2 remains the truth for what exists.
 */
export async function listMedia(
  env: Env,
  options: ListMediaOptions = {},
): Promise<MediaPage> {
  // SPREAD, deliberately, not a hand-copied key list: the hand-copied list is
  // the defect this replaced. `limit` is the one axis with a default of its own.
  const { rows, page, hasMore } = await listMediaPage(env, {
    ...options,
    limit: options.limit ?? MEDIA_PAGE_SIZE,
  });

  return {
    objects: rows.map((row) => ({
      key: row.key,
      // A static asset IS its public path, so it is served directly rather than
      // through /media/. Sending it through the R2 route would 404: the object
      // is on the assets host, not in the bucket.
      url: row.storage === "static" ? row.key : `/media/${row.key}`,
      size: row.bytes ?? 0,
      uploaded: row.uploadedAt ?? "",
      storage: row.storage,
      kind: row.kind,
      role: row.role,
      mime: row.mime,
      originalName: row.originalName,
      width: row.width,
      height: row.height,
      alt: row.alt,
      caption: row.caption,
      tags: row.tags,
      placeholder: row.placeholder,
      deletable: row.storage !== "static",
    })),
    page,
    hasMore,
  };
}

/**
 * Intrinsic dimensions of bytes in hand, before anything has been stored.
 *
 * The upload path needs the measurement BEFORE it has a key: since finding
 * B002 the key carries `-<w>x<h>`, so the measurement is an INPUT to the key
 * rather than something looked up after the fact. Measuring once and using it for both the key and
 * the row also means those two cannot disagree about the same image.
 */
export async function measureDimensions(
  env: Env,
  body: ReadableStream | ArrayBuffer,
): Promise<{ width: number; height: number } | null> {
  const stream = body instanceof ArrayBuffer ? new Blob([body]).stream() : body;
  try {
    const info = await env.IMAGES.info(stream);
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

/**
 * True when the key is one this module is willing to touch.
 *
 * DELEGATES TO THE GRAMMAR'S OWNER and carries no pattern of its own. The
 * regex that lived here predated the dimension segment `contentKey` writes
 * into raster keys, so every uploaded raster was refused by delete, set-alt
 * and empty-trash while the guard looked correct. A reader that restates a
 * grammar fails exactly when the writer moves; `isContentKey` sits beside the
 * writer, where a change to one is a change made looking at the other.
 *
 * What the shape test refuses on this module's behalf: anything with a slash
 * (so a traversal segment, a leading `/` static path and an `og/` derived key
 * all fail), and anything that is not a digest-plus-extension a real upload
 * could have produced.
 */
export function isManagedKey(key: string) {
  return isContentKey(key);
}
