import { defineImages } from "@dustinedwards/site-runtime/image";

// CSS pixels, never physical: the browser multiplies by the device pixel ratio itself. The 44rem prose column
// is about 704 CSS px.
export const CONTENT_SIZES = "(min-width: 46rem) 704px, calc(100vw - 2rem)";

/**
 * Every way the site shows an image from /media, and so the route's closed width set (site-runtime ./image):
 * the set is CLOSED because the Images binding bills each unique transform, and the pipeline and the route
 * share it, so a width the page advertises is never a 400 mid-article. `breakpoints` keeps the widths the
 * site served before the move (640, 1024, 1408), so cached pages and feeds that link `?w=1024` still work;
 * the content use then serves 640, 704, 1024 and 1408. `tile` is the admin grid and the about photo (320
 * and 640), scaled, never cropped.
 */
export const images = defineImages({
  breakpoints: [640, 1024, 1408],
  uses: {
    content: { layout: "constrained", width: 704, sizes: CONTENT_SIZES },
    tile: { layout: "fixed", width: 320 },
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
