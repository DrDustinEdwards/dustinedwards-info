// The media types the library stores, and the size cap. Must stay loadable by node:test: never import anything reaching a
// binding, a `.server` module or React.

export const ALLOWED = new Map([
  ["image/webp", "webp"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  // Stored as JPEG (site-api's prepareUpload converts them), so the extension is never used.
  ["image/heic", "jpg"],
  ["image/heif", "jpg"],
  // A chart's data (checklist E3): a post cites it as `:::chart{src="/media/<key>"}`, and the render reads it through
  // Prelum's chartData (app/lib/content/chart-data.mjs). Text, so it has no size and no Images step.
  ["text/csv", "csv"],
]);

/** The data files in ALLOWED: stored as uploaded, with no size in the key. */
export const DATA_TYPES = new Set(["text/csv"]);

export const MAX_BYTES = 10 * 1024 * 1024;
