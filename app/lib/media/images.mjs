import { defineImages, pictureProps } from "@dustinedwards/site-runtime/image";

import { dimensionsFromKey } from "./classify.mjs";

// CSS pixels, never physical: the browser multiplies by the device pixel ratio itself. The 44rem prose column
// is about 704 CSS px.
const CONTENT_SIZES = "(min-width: 46rem) 704px, calc(100vw - 2rem)";

/**
 * The static photographs /media serves from the site's own assets, so they get the sizes and formats an upload gets:
 * the roster's cohort photos (ROSTER_PHOTO_DIR), which stay files in `public/`. The key, without its leading slash.
 */
const STATIC_MEDIA = /^phage-hunters\/[A-Za-z0-9._-]+\.webp$/;

/** @param {string} key a /media key */
export function isStaticMedia(key) {
  return STATIC_MEDIA.test(key);
}

/**
 * The /media address of an image: a static photograph /media serves moves under it; anything else is unchanged.
 * @param {string} src
 */
export function mediaSrc(src) {
  return isStaticMedia(src.slice(1)) ? `/media${src}` : src;
}

/**
 * Every way the site shows an image from /media, and so the route's closed width set (site-runtime ./image):
 * the set is CLOSED because the Images binding bills each unique transform, and the pipeline and the route
 * share it, so a width the page advertises is never a 400 mid-article. `breakpoints` keeps the widths the
 * site served before the move (640, 1024, 1408), so cached pages and feeds that link `?w=1024` still work;
 * the content use then serves 640, 704, 1024 and 1408. `tile` is the admin grid and `portrait` the about photo
 * (both 320 and 640), scaled, never cropped.
 */
export const images = defineImages({
  breakpoints: [640, 1024, 1408],
  uses: {
    content: { layout: "constrained", width: 704, sizes: CONTENT_SIZES },
    tile: { layout: "fixed", width: 320 },
    portrait: { layout: "fixed", width: 320, sizes: "(min-width: 46rem) 14rem, 11rem" },
  },
});

/**
 * Responsive attributes for one /media image in the prose column. A key that does not carry its size gets the
 * ladder anyway, as before the move: the route scales down and never up, so a smaller original is served at its
 * own size.
 *
 * @param {string} src a `/media/` path
 * @param {{ width: number, height: number } | null} dimensions
 */
export function contentImage(src, dimensions) {
  const { width, height } = dimensions ?? { width: 2816, height: 2816 };
  return images.attributes({ src, width, height }, "content");
}

/**
 * A picture in the prose column as a `<picture>`: a /media image at its stored size, else the size its key spells, gets
 * the content use with AVIF and WebP; anything else (a static file, an SVG) has no size to read and gets a plain `src`,
 * since an invented size would distort the image.
 *
 * @param {string} src
 * @param {{ alt: string, width?: number | null, height?: number | null, priority?: boolean, className?: string }} options
 */
export function contentPicture(src, { alt, width, height, priority = false, className }) {
  const dimensions = width && height ? { width, height } : dimensionsFromKey(src);
  const attrs =
    dimensions && src.startsWith("/media/")
      ? contentImage(src, dimensions)
      : { src, srcset: undefined, sizes: undefined, sources: [], width: dimensions?.width, height: dimensions?.height, background: undefined };
  return pictureProps(attrs, { alt, priority, className });
}
