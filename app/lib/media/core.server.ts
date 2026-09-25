import { listMediaPage } from "~/db";

import { isContentKey } from "./classify.mjs";
import { WEBP_QUALITY } from "./encoding.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

// Content-agnostic: nothing post-shaped is imported here; citations arrive through the resolver seam.

export const MEDIA_PAGE_SIZE = 24;

// A closed set: the width lands in a cache key, and each distinct transform is billed.
type ThumbWidth = 160 | 320 | 640;

type MediaObject = {
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
};

type MediaPage = {
  objects: MediaObject[];
  page: number;
  hasMore: boolean;
};

export function thumbUrl(key: string, width: ThumbWidth) {
  // A static asset key already begins with `/`; prefixing `/media/` gives a double slash the R2 route 404s on.
  if (key.startsWith("/")) return key;
  return `/media/${key}?w=${width}`;
}

export function isViewable(kind: string) {
  return kind === "image";
}

// Derived from `listMediaPage` and forwarded by spread: a hand-copied options type dropped axes
// silently, because spreads are exempt from excess-property checks.
type ListMediaOptions = NonNullable<Parameters<typeof listMediaPage>[1]>;

export async function listMedia(
  env: Env,
  options: ListMediaOptions = {},
): Promise<MediaPage> {
  const { rows, page, hasMore } = await listMediaPage(env, {
    ...options,
    limit: options.limit ?? MEDIA_PAGE_SIZE,
  });

  return {
    objects: rows.map((row) => ({
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
    })),
    page,
    hasMore,
  };
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

// LQIP, not ThumbHash or BlurHash: those need client-side decoding and the public plane ships no
// framework script. The quality is required: without it the binding emits LOSSLESS WebP.
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

// No reference check here on purpose: the safety belongs in the action, which has the resolver's answer.
export async function deleteMediaObject(env: Env, key: string) {
  await env.MEDIA.delete(key);
}

export function isManagedKey(key: string) {
  return isContentKey(key);
}
