import { listMediaPage } from "~/db";

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

/**
 * The prefix that marks a derived object.
 *
 * Kept only for `isManagedKey`, which is a guard over a key an HTTP request
 * supplied. Listing no longer needs it: the D1 query filters on the `storage`
 * column, which is a fact about the row rather than a guess from its name.
 */
const DERIVED_PREFIX = "og/";

/**
 * Widths the thumbnail route will honour.
 *
 * A closed set, because the width lands in a cache key and an open one lets any
 * caller mint unlimited distinct transforms of the same object, each of which
 * is a billed unique transformation. Three sizes cover the grid thumbnail, the
 * picker tile and a 2x display of either.
 */
/* Re-exported from widths.mjs so this module stays the one import an admin
 * surface needs, while the ladders themselves live somewhere the markdown
 * pipeline can also reach. The pipeline cannot import this file: it is a
 * `.server.ts` that imports `~/db`, and the build scripts run it in Node. */
export {
  ALL_WIDTHS,
  CONTENT_SIZES,
  CONTENT_WIDTHS,
  THUMB_WIDTHS,
  contentSrcSet,
} from "./widths.mjs";
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
  options: {
    page?: number;
    limit?: number;
    insertableOnly?: boolean;
    role?: string;
    unusedOnly?: boolean;
    /** Free text. Which columns it matches is `matchesQuery`'s business. */
    q?: string;
  } = {},
): Promise<MediaPage> {
  const { rows, page, hasMore } = await listMediaPage(env, {
    page: options.page,
    limit: options.limit ?? MEDIA_PAGE_SIZE,
    insertableOnly: options.insertableOnly,
    role: options.role,
    unusedOnly: options.unusedOnly,
    q: options.q,
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
 * Split out from `readDimensions` for the upload path, which needs the
 * measurement BEFORE it has a key: since finding B002 the key carries
 * `-<w>x<h>`, so the measurement is an INPUT to the key rather than something
 * looked up after the fact. Measuring once and using it for both the key and
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

/** Intrinsic dimensions, read from the bytes rather than trusted from a client. */
export async function readDimensions(
  env: Env,
  key: string,
): Promise<{ width: number; height: number } | null> {
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  return measureDimensions(env, object.body);
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
 * It used to be a positive test against the `posts/` prefix. Content addressing
 * removed that anchor, so the test is now the SHAPE of a content key plus an
 * explicit refusal of the derived prefix. Anchored at both ends, so nothing with
 * a slash, a traversal segment or a leading `/` (which would be a static asset,
 * and static assets are not deletable through the UI) can pass.
 */
const CONTENT_KEY = /^[0-9a-f]{16}\.[a-z0-9]+$/;

export function isManagedKey(key: string) {
  return CONTENT_KEY.test(key) && !key.startsWith(DERIVED_PREFIX);
}
