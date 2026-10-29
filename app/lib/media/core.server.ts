import { listMediaPage } from "~/db";

import { isContentKey } from "./classify.mjs";
import { defineImages } from "@dustinedwards/site-runtime/image";
import { errorMessage } from "~/lib/error-message.mjs";
import { toBase64 } from "@dustinedwards/site-runtime/encoding";

// Content-agnostic: nothing post-shaped is imported here; citations arrive through the resolver seam.

export type MediaObject = {
  key: string;
  url: string;
  size: number;
  uploaded: string;
  storage: string;
  kind: string;
  role: string;
  mime: string | null;
  originalName: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  tags: string;
  placeholder: string | null;
  deletable: boolean;
  /** The focal point in site-runtime ./image's spelling ("XxY", 0 to 1), or null for the center. */
  focus: string | null;
  /** When the file was trashed (the index's `trashed_at`), or null in the library. */
  trashedAt: string | null;
  /** The index row's revision, which every metadata edit, trash move and replace bump (writeMediaAtRev). */
  rev: number;
};

type MediaPage = {
  objects: MediaObject[];
  page: number;
  hasMore: boolean;
};

// Derived from `listMediaPage` and forwarded by spread: a hand-copied options type dropped axes
// silently, because spreads are exempt from excess-property checks.
type ListMediaOptions = NonNullable<Parameters<typeof listMediaPage>[1]>;

type MediaRow = Awaited<ReturnType<typeof listMediaPage>>["rows"][number];

/** One index row as the library shows it; Carrel's media adapter reads the same shape. */
export function mediaObjectOf(row: MediaRow): MediaObject {
  return {
    key: row.key,
    // Static assets live on the assets host, not in the bucket, so `/media/` would 404.
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
    focus: focusText(row.focalX, row.focalY),
    trashedAt: row.trashedAt,
    rev: row.rev,
  };
}

/** The index's two focal columns as one focal point, or null when either is unset. */
function focusText(x: number | null, y: number | null): string | null {
  if (x === null || y === null) return null;
  const part = (n: number) => String(Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);
  return `${part(x)}x${part(y)}`;
}

export async function listMedia(
  env: Env,
  options: ListMediaOptions = {},
): Promise<MediaPage> {
  const { rows, page, hasMore } = await listMediaPage(env, options);

  return { objects: rows.map(mediaObjectOf), page, hasMore };
}

// Measured before a key exists, because the key carries the dimensions. Null means the binding answered
// with no pixel dimensions (an SVG); a binding that throws is NOT that answer, so the throw propagates:
// read as null it would mint a permanent key with no size, or write empty sizes over measured ones.
export async function measureDimensions(
  env: Env,
  body: ReadableStream | ArrayBuffer,
): Promise<{ width: number; height: number } | null> {
  const stream = body instanceof ArrayBuffer ? new Blob([body]).stream() : body;
  let info: Awaited<ReturnType<Env["IMAGES"]["info"]>>;
  try {
    info = await env.IMAGES.info(stream);
  } catch (error) {
    throw new Error(
      `Cloudflare Images could not measure the image: ` +
        `${errorMessage(error)}`,
      { cause: error },
    );
  }
  // An SVG has no pixel dimensions: record nothing rather than 0.
  if ("width" in info && "height" in info) {
    return { width: info.width, height: info.height };
  }
  return null;
}

const PLACEHOLDER_WIDTH = 20;

/**
 * The placeholder's own closed set, never served by /media: the transform goes through site-runtime's image
 * route like every other, so the quality is always passed (without it the binding emits LOSSLESS WebP).
 */
const PLACEHOLDER = defineImages({ uses: { placeholder: { layout: "fixed", width: PLACEHOLDER_WIDTH } } });

// LQIP, not ThumbHash or BlurHash: those need client-side decoding and the public plane ships no
// framework script. The caller has already decided the body is a raster; the binding reads its real format.
export async function placeholderFor(
  env: Env,
  body: ReadableStream | ArrayBuffer,
): Promise<string | null> {
  const stream = body instanceof ArrayBuffer ? new Blob([body]).stream() : body;
  const object = { body: stream, httpEtag: "", httpMetadata: { contentType: "image/webp" }, writeHttpMetadata() {} };
  try {
    const response = await PLACEHOLDER.respond(new Request(`https://placeholder.invalid/p?w=${PLACEHOLDER_WIDTH}`), {
      object,
      images: env.IMAGES,
    });
    // Anything but a transformed size (no binding, a failed transform) is no placeholder.
    if (!response.headers.get("x-image")?.startsWith("w=")) return null;
    const buffer = await response.arrayBuffer();
    return `data:image/webp;base64,${toBase64(new Uint8Array(buffer))}`;
  } catch {
    return null;
  }
}

// No reference check here on purpose: the safety belongs in the action, which has the resolver's answer.
export async function deleteMediaObject(env: Env, key: string) {
  await env.MEDIA.delete(key);
}

export function isManagedKey(key: string) {
  return isContentKey(key);
}
