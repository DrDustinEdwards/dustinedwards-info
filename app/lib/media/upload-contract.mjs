// The form branch is selected ONLY by `intent=upload-form`, never by sniffing a header: a changed
// default header would silently hand the editors' `response.json()` an HTML page.
// Must stay loadable by node:test: never import anything reaching a binding, a `.server` module or React.

import { byteSize } from "./byte-size.mjs";

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

// NOT IN THE ALLOWLIST, and refused by name rather than as an unknown type: an SVG can carry script,
// and /media is this site's own origin. The /media CSP (workers/csp.mjs) is the second wall, for
// anything that reaches the bucket some other way.
const SVG_TYPE = "image/svg+xml";

const SVG_REFUSED =
  "SVG is not accepted: it can carry script, and /media is this site's own origin. " +
  "Export it as PNG or WebP.";

// A hint, not a control: drag-drop or a scripted post ignores `accept`. The control is the server check.
export const ACCEPT_ATTRIBUTE = [...ALLOWED.keys()].join(",");

export const MAX_BYTES = 10 * 1024 * 1024;

export const UPLOAD_FORM_INTENT = "upload-form";

export const UPLOAD_RETURN_PATH = "/admin/media";

/**
 * @param {unknown} intent the submitted `intent` field, whatever arrived
 * @returns {boolean}
 */
export function isFormUpload(intent) {
  return intent === UPLOAD_FORM_INTENT;
}

/**
 * Both editors destructure `url`, and one inserts it into the markdown: a rename breaks inserts with no
 * type error.
 *
 * @param {string} key
 */
export function uploadSuccessBody(key) {
  return { url: `/media/${key}`, key };
}

/**
 * @param {string} message
 */
export function uploadErrorBody(message) {
  return { error: message };
}


// A code in the URL, not the message, so the address bar never carries prose someone can edit.
const UPLOAD_ERRORS = {
  "no-file": "No file was chosen.",
  "unsupported-type":
    `That file type is not one this endpoint accepts. Uploads here are images and chart data: ` +
    `${[...ALLOWED.keys()].map((mime) => mime.split("/")[1]).join(", ")}.`,
  "too-large": `That image is over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
  "svg-refused": SVG_REFUSED,
  "content-mismatch":
    "That file's bytes are not the image type it was uploaded as. " +
    "Export the image again as PNG, JPEG or WebP.",
  "images-unavailable":
    "The image could not be measured, because Cloudflare Images did not answer. " +
    "Nothing was stored; try again.",
};

/**
 * `no-file` is left to each caller, because its repair differs. The byte signature is site-api's prepareUpload's,
 * after this: SVG bytes declared `image/png` fail it as `content-mismatch`.
 *
 * @param {{ type: string, bytes: { byteLength: number } }} file what arrived, before any store
 * @returns {{ code: "unsupported-type" | "svg-refused" | "too-large", message: string, status: number } | null}
 */
export function validateUpload({ type, bytes }) {
  const size = bytes.byteLength;

  // Before the generic check, so the refusal says why instead of reading as an oversight.
  if (type.toLowerCase().split(";")[0]?.trim() === SVG_TYPE) {
    return { code: "svg-refused", message: SVG_REFUSED, status: 415 };
  }

  if (!ALLOWED.has(type)) {
    return {
      code: "unsupported-type",
      message: `Unsupported file type "${type || "unknown"}".`,
      status: 415,
    };
  }

  if (size > MAX_BYTES) {
    return {
      code: "too-large",
      message: `The file is ${byteSize(size)}, over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
      status: 413,
    };
  }

  return null;
}

/**
 * @param {string | null} code
 * @returns {string | null} the sentence, or null for a code nothing emits
 */
export function uploadErrorSentence(code) {
  if (!code) return null;
  return Object.prototype.hasOwnProperty.call(UPLOAD_ERRORS, code)
    ? UPLOAD_ERRORS[/** @type {keyof typeof UPLOAD_ERRORS} */ (code)]
    : null;
}

/**
 * Success carries the key, so a reload repeats a harmless read rather than a second upload.
 *
 * @param {{ ok: true, key: string } | { ok: false, code: string }} result
 */
export function uploadRedirectTo(result) {
  const params = result.ok
    ? `uploaded=${encodeURIComponent(result.key)}`
    : `upload-error=${encodeURIComponent(result.code)}`;
  return `${UPLOAD_RETURN_PATH}?${params}`;
}
