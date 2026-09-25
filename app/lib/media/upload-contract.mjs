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
  ["image/svg+xml", "svg"],
]);

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
export const UPLOAD_ERRORS = {
  "no-file": "No file was chosen.",
  "unsupported-type":
    `That file type is not one this endpoint accepts. Uploads here are images: ` +
    `${[...ALLOWED.keys()].map((mime) => mime.split("/")[1]).join(", ")}.`,
  "too-large": `That image is over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
  "content-mismatch":
    "That file begins as markup, so it is not the image type it was uploaded " +
    "as. Upload an SVG as image/svg+xml.",
  "images-unavailable":
    "The image could not be measured, because Cloudflare Images did not answer. " +
    "Nothing was stored; try again.",
};

/**
 * `no-file` is left to each caller, because its repair differs. Takes the BYTES because the type is a
 * claim: SVG bytes declared `image/png` would escape the SVG-as-attachment rule and be served inline.
 *
 * @param {{ type: string, bytes: ArrayBuffer }} file what arrived, before any store
 * @returns {{ code: "unsupported-type" | "too-large" | "content-mismatch", message: string, status: number } | null}
 */
export function validateUpload({ type, bytes }) {
  const size = bytes.byteLength;

  if (!ALLOWED.has(type)) {
    return {
      code: "unsupported-type",
      message: `Unsupported image type "${type || "unknown"}".`,
      status: 415,
    };
  }

  if (size > MAX_BYTES) {
    return {
      code: "too-large",
      message: `Image is ${byteSize(size)}, over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
      status: 413,
    };
  }

  // Last: the only check that reads the payload.
  if (type !== "image/svg+xml" && beginsAsMarkup(bytes)) {
    return {
      code: "content-mismatch",
      message:
        `Those bytes begin as markup and the declared type is "${type}". ` +
        `Upload an SVG as image/svg+xml.`,
      status: 415,
    };
  }

  return null;
}

/**
 * One byte, `<`: an XML declaration, a doctype, a comment and `<svg` all start with it. The BOM skip
 * matters: a file saved from a Windows editor carries one.
 *
 * @param {ArrayBuffer} bytes
 * @returns {boolean}
 */
export function beginsAsMarkup(bytes) {
  const view = new Uint8Array(bytes);
  let at = 0;
  if (view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) at = 3;
  // A leading NUL is not skipped: that would be UTF-16, which no allowed type is.
  while (at < view.length && (view[at] === 0x20 || view[at] === 0x09 || view[at] === 0x0a || view[at] === 0x0d)) {
    at += 1;
  }
  return view[at] === 0x3c;
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
