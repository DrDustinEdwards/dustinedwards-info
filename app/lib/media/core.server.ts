import { listMediaPage } from "~/db";

import { isContentKey } from "./classify.mjs";
import { WEBP_QUALITY } from "./encoding.mjs";

/**
 * MEDIA CORE. Library listing, upload, thumbnails, metadata and delete mechanics.
 *
 * This module knows nothing about what cites an object. CONTENT-AGNOSTIC BY CONSTRUCTION, NOT BY
 * CONVENTION: there is no import of anything post-shaped in this file and no parameter that could
 * carry one. "Who cites this key?" is asked through the resolver seam and the answer arrives as data
 * the core never inspects, which is what lets another type register later without this file changing.
 */

/** One page. Small enough to be a page rather than a dump of the bucket. */
export const MEDIA_PAGE_SIZE = 24;

/*
 * `DERIVED_PREFIX` is GONE. It excluded `og/` keys beside its own copy of the key grammar, and the
 * grammar now has one owner whose pattern admits no slash, so an `og/` key fails the shape test
 * itself and the prefix check had nothing left to refuse.
 */

/**
 * Widths the thumbnail route will honour. A CLOSED SET, because the width lands in a cache key and
 * an open one lets any caller mint unlimited distinct transforms of the same object, each a billed
 * transformation.
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
 * The URL that renders this object at a thumbnail width. URL-DERIVED: the width is in the URL, the
 * transform happens on request from the single original in R2, and no variant is ever written back.
 */
export function thumbUrl(key: string, width: ThumbWidth) {
  // A STATIC ASSET IS ITS OWN PUBLIC PATH and already begins with `/`, so prefixing `/media/` yields
  // a double slash the R2 route 404s on. It is served by the assets host directly, so it needs no
  // transform URL and gets none.
  //
  // The cost is that it is delivered at full size into a thumbnail box. These are small files and a
  // correct image beats a resized 404; serving static transforms would mean teaching `/media/*` to
  // read through ASSETS.
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
 * Restating them is what broke `listMedia`: the options type named half the axes, the loader
 * forwarded all of them through an object SPREAD, and spreads are exempt from excess-property
 * checking, so the rest were accepted by the compiler and dropped on the floor.
 *
 * Deriving the type means a new axis is covered by construction instead of by somebody remembering.
 * `check:media-axes` asserts both halves: that this stays derived, and that the forwarding stays a
 * spread.
 */
type ListMediaOptions = NonNullable<Parameters<typeof listMediaPage>[1]>;

/**
 * Lists one page of the library FROM D1.
 *
 * IT NO LONGER TOUCHES R2, and that is the point of the index. Listing from the bucket could only
 * paginate in key order, which stopped meaning anything when keys became content-addressed digests,
 * and every question the library asks is a query.
 *
 * D1 is DERIVED, so this is reading a copy, and that is legitimate for one reason: the copy is
 * exhaustively reconcilable against its source and `check:media` reconciles it in both directions.
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
 * Intrinsic dimensions of bytes in hand, before anything has been stored. The upload path needs
 * the measurement BEFORE it has a key, because the key carries the dimensions, so it is an INPUT to
 * the key rather than a lookup after the fact. Measuring once for both means the key and the row
 * cannot disagree about the same image.
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

/** The LQIP width, in pixels. What that costs as a data URI is check:image-weight's. */
const PLACEHOLDER_WIDTH = 20;

/**
 * A tiny base64 data URI standing in for the image until it loads.
 *
 * LQIP rather than ThumbHash or BlurHash: both need client-side decoding and the public plane ships
 * no framework script (rule 4). What it costs is MEASURED by `check:image-weight` and stated
 * nowhere else.
 *
 * Returns null rather than throwing: an image the transformer cannot read simply has no placeholder,
 * and that must not fail a rebuild or a queue message.
 *
 * THE QUALITY IS NOT OPTIONAL. The binding emits LOSSLESS WebP when none is given, which is the
 * worst possible answer in the one column whose purpose is to inline.
 *
 * IT LIVES HERE because it has two callers, the bulk rebuild and the queue consumer, and a
 * measurement with two implementations is two answers.
 */
export async function placeholderFor(
  env: Env,
  body: ReadableStream | ArrayBuffer,
): Promise<string | null> {
  const stream = body instanceof ArrayBuffer ? new Blob([body]).stream() : body;
  try {
    const result = await env.IMAGES.input(stream)
      .transform({ width: PLACEHOLDER_WIDTH })
      .output({ format: "image/webp", quality: WEBP_QUALITY });
    const buffer = await result.response().arrayBuffer();
    let binary = "";
    const view = new Uint8Array(buffer);
    for (const byte of view) binary += String.fromCharCode(byte);
    return `data:image/webp;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/**
 * Deletes one object. MECHANICS ONLY.
 *
 * There is deliberately no reference check in here. This module cannot see citations and must not
 * appear to: a `deleteMedia` that sometimes refused would invite a caller to treat it as the safety,
 * and the safety belongs in the action where the resolver's answer is available.
 */
export async function deleteMediaObject(env: Env, key: string) {
  await env.MEDIA.delete(key);
}

/**
 * True when the key is one this module is willing to touch. DELEGATES TO THE GRAMMAR'S OWNER and
 * carries no pattern of its own: a reader that restates a grammar fails exactly when the writer
 * moves, and `isContentKey` sits beside the writer.
 *
 * What the shape test refuses on this module's behalf: anything with a slash, so a traversal
 * segment, a leading `/` static path and an `og/` derived key all fail, and anything that is not a
 * digest-plus-extension a real upload could have produced.
 */
export function isManagedKey(key: string) {
  return isContentKey(key);
}
