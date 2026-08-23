/**
 * The upload endpoint's CONTRACT: what it accepts, what it answers, and which
 * of its two callers is asking.
 *
 * `/admin/media/upload` has two clients that cannot be collapsed into one. The
 * two editors `fetch` it and read JSON. The media library posts a FORM and
 * navigates, so it needs a redirect and a message it can render on arrival.
 *
 * ## THE BRANCH IS AN EXPLICIT SIGNAL, NEVER A SNIFF
 *
 * The form carries a hidden `intent=upload-form`. Nothing else selects the
 * navigation branch: not the Accept header, not Sec-Fetch-Mode, not the absence
 * of a header the editors happen not to send today.
 *
 * A sniff would make the editors' contract depend on something they never
 * declared, so any client library, proxy or browser that changed a default
 * header would silently move them onto the redirect path and their `await
 * response.json()` would receive an HTML document. `isFormUpload` is therefore
 * an EQUALITY against one token and is tested as such: `"1"`, `"true"`, an
 * empty string and `undefined` are all the editors' path.
 *
 * ## WHY A PLAIN .mjs WITH NO IMPORTS
 *
 * Same reason as `media-ref-key.mjs`: the Worker can load it and so can
 * `node:test`, with no bundler. `admin.media.upload.ts` imports `~/db` and a
 * `.server` module, so nothing in it is reachable from a unit test, and a
 * contract that cannot be asserted is a contract that moves.
 *
 * The limits live here rather than in the route because the library's error
 * sentences are derived from them. Stated once, read three ways: enforced by
 * the route, spoken by the page, asserted by the test.
 */

/** MIME type to file extension. The closed set the bucket accepts. */
export const ALLOWED = new Map([
  ["image/webp", "webp"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

/**
 * The `accept` attribute for a file input, DERIVED from the allowlist above.
 *
 * Both file inputs said `accept="image/*"`, which is a THIRD answer to what
 * this site uploads: wider than the map in one direction (it offers tiff and
 * bmp, which the server refuses) and narrower in none. The picker offering a
 * file the server will reject is a defect the reader meets after choosing.
 *
 * A HINT, NOT A CONTROL. `accept` filters a file dialog and nothing more; a
 * drag-drop or a scripted post ignores it entirely. The control is the server
 * check against ALLOWED, which is untouched.
 */
export const ACCEPT_ATTRIBUTE = [...ALLOWED.keys()].join(",");

/** 10 MB. */
export const MAX_BYTES = 10 * 1024 * 1024;

/** The hidden field's value. The ONLY thing that selects the form branch. */
export const UPLOAD_FORM_INTENT = "upload-form";

/** Where a form upload navigates back to, success or failure. */
export const UPLOAD_RETURN_PATH = "/admin/media";

/**
 * Is this the library's form, or one of the editors' fetches?
 *
 * @param {unknown} intent the submitted `intent` field, whatever arrived
 * @returns {boolean}
 */
export function isFormUpload(intent) {
  return intent === UPLOAD_FORM_INTENT;
}

/**
 * THE SUCCESS BODY BOTH EDITORS READ. Two keys, and neither may move.
 *
 * `markdown-editor.tsx` and `post-editor.tsx` both destructure `url` from it,
 * and the second inserts that string straight into the markdown, so a rename
 * here is a broken insert there with no type error to catch it.
 *
 * @param {string} key
 */
export function uploadSuccessBody(key) {
  return { url: `/media/${key}`, key };
}

/**
 * THE ERROR BODY. One key, `error`, carrying a sentence an author can act on.
 *
 * `markdown-editor.tsx` shows it verbatim and falls back to the status code
 * when it is absent, which is why the sentence names the real reason rather
 * than restating the status.
 *
 * @param {string} message
 */
export function uploadErrorBody(message) {
  return { error: message };
}

/**
 * The codes a form upload carries back in the URL, and the sentence each one
 * becomes on the page.
 *
 * A CODE rather than the message itself: the message is composed from the
 * limits above, and putting prose in a query string means an error the operator
 * can edit by hand in the address bar.
 */
export const UPLOAD_ERRORS = {
  "no-file": "No file was chosen.",
  "unsupported-type":
    `That file type is not one this endpoint accepts. Uploads here are images: ` +
    `${[...ALLOWED.keys()].map((mime) => mime.split("/")[1]).join(", ")}.`,
  "too-large": `That image is over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
};

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
 * Where a form upload lands afterwards.
 *
 * Success carries the KEY rather than a flash message, so the page can say
 * which object arrived and link to it, and so a reload repeats a harmless read
 * rather than a second upload.
 *
 * @param {{ ok: true, key: string } | { ok: false, code: string }} result
 */
export function uploadRedirectTo(result) {
  const params = result.ok
    ? `uploaded=${encodeURIComponent(result.key)}`
    : `upload-error=${encodeURIComponent(result.code)}`;
  return `${UPLOAD_RETURN_PATH}?${params}`;
}
