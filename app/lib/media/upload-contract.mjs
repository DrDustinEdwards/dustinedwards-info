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
 * ## WHY A PLAIN .mjs, AND WHAT IT MAY IMPORT
 *
 * Same reason as `media-ref-key.mjs`: the Worker can load it and so can
 * `node:test`, with no bundler. `admin.media.upload.ts` imports `~/db` and a
 * `.server` module, so nothing in it is reachable from a unit test, and a
 * contract that cannot be asserted is a contract that moves.
 *
 * **The rule is the LOADABILITY, not the import count.** This said "with no
 * imports" until 2026-09-07 and then acquired one: `byteSize`, a sibling
 * dependency-free `.mjs`, because `validateUpload` composes the too-large
 * sentence and the formatting has exactly one owner. What must
 * never appear here is an import that reaches a binding, a `.server` module or
 * anything React, because any one of those makes this module unloadable by
 * `node:test` and takes the assertions below down with it.
 *
 * The limits live here rather than in the route because the library's error
 * sentences are derived from them. Stated once, read three ways: enforced by
 * the route, spoken by the page, asserted by the test.
 */

import { byteSize } from "./byte-size.mjs";

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
  "content-mismatch":
    "That file begins as markup, so it is not the image type it was uploaded " +
    "as. Upload an SVG as image/svg+xml.",
};

/**
 * THE TWO CONTRACT REFUSALS, decided here so no caller can decide them again.
 *
 * `/admin/media/upload` decided them inline until 2026-09-07, which was fine
 * while it was the only writer to the bucket. The operator API's `upload_media`
 * is a second one, and the rule it is held to is that a refusal reads the same
 * whichever door you knocked on: an agent that gets one sentence from the
 * editor and a different one from the API cannot tell a policy from a bug.
 *
 * ## WHAT IT COVERS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * The TYPE, the SIZE and one CONTRADICTION BETWEEN THE TWO CLAIMS, because all
 * three are properties of the bucket's contract and are the same question no
 * matter who is asking.
 *
 * `no-file` is NOT here, and that is deliberate rather than an omission. The
 * form's missing input is a `File` that did not arrive; the operator tool's is
 * neither `data` nor `url` given. They are different questions with different
 * repairs, so each caller names its own and they share only the code.
 *
 * ## WHY IT TAKES THE BYTES AND NOT A SIZE
 *
 * Because THE TYPE IS ALWAYS A CLAIM, and one wrong claim reaches past this
 * module. `media.$.ts` serves an SVG as an attachment with `nosniff`, and it
 * decides that from the STORED content type, which is whatever the uploader
 * said. So SVG bytes declared `image/png` are stored as `image/png`, escape
 * that rule, and are served inline off this site's own origin. Both callers
 * could always do it: `file.type` on a multipart part is browser-supplied and a
 * hand-built post says whatever it likes. Nothing had noticed because the
 * editor is the only thing that had ever posted here.
 *
 * `beginsAsMarkup` is the check, and it is a sniff used ONLY TO REFUSE. Nothing
 * downstream trusts what it says; a false positive costs one legitimate upload
 * a clear error, and there are none available: every raster this allowlist
 * accepts starts with its own magic number, none of which is `<`. It is not a
 * general content check and does not pretend to be one, which is why it is
 * named for the one thing it can see.
 *
 * ## THE MESSAGE AND THE CODE ARE BOTH RETURNED, because both are used
 *
 * The code is what the library's form carries back in the URL, resolved
 * through `UPLOAD_ERRORS` on arrival. The message is what the editors show
 * verbatim in the JSON body and what the MCP wrapper passes through. They say
 * the same thing at different resolutions: the sentence here names the type
 * that actually arrived and the size actually measured, which a code in a query
 * string cannot.
 *
 * @param {{ type: string, bytes: ArrayBuffer }} file what arrived, before any store
 * @returns {{ code: "unsupported-type" | "too-large" | "content-mismatch", message: string, status: number } | null}
 *   null when the upload is accepted, which is the only accepting answer
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
      // `byteSize` and not a second conversion: the refusal used to spell
      // `Math.round(size / 1024)` kB and only ever ran above 10 MB, so it
      // always reported a five-figure kilobyte number one clause before its
      // own limit was stated in MB. That is what gave byte-size.mjs an owner.
      message: `Image is ${byteSize(size)}, over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
      status: 413,
    };
  }

  /*
   * LAST, because it is the only one that reads the payload, and because the
   * two above are the refusals a caller meets by accident. This one is met by
   * a caller doing something specific.
   */
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
 * Do these bytes begin as markup, ignoring a BOM and leading whitespace?
 *
 * ONE BYTE, `<`, and nothing more clever. An XML declaration, a doctype, a
 * comment and a bare `<svg` all start with it, so a parser is not needed to
 * answer the only question being asked. Anything narrower could be walked
 * around by whitespace or a comment; anything wider starts making claims about
 * content this cannot support.
 *
 * The BOM skip is load-bearing rather than tidiness: a UTF-8 BOM is exactly
 * what a file saved out of a Windows editor carries, and three bytes in front
 * of the `<` would defeat the check entirely.
 *
 * @param {ArrayBuffer} bytes
 * @returns {boolean}
 */
export function beginsAsMarkup(bytes) {
  const view = new Uint8Array(bytes);
  let at = 0;
  if (view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) at = 3;
  // Space, tab, LF, CR. A leading NUL is not whitespace and is not skipped: a
  // reader that skipped it would be describing UTF-16, which no allowed type is.
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
