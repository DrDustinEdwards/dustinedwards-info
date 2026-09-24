/**
 * The upload endpoint's reply contract, and the branch that must never guess.
 *
 * WHAT THIS PROTECTS. `/admin/media/upload` has two editors reading its JSON:
 * `markdown-editor.tsx` destructures `url` and shows `error` verbatim, and
 * `post-editor.tsx` destructures `url` and inserts it straight into markdown.
 * Neither is typed against the route, so renaming a key breaks an insert with
 * no compile error anywhere. The media library then added a THIRD caller that
 * wants a redirect instead, which is exactly the change most likely to move the
 * other two by accident.
 *
 * So the shapes are objects built by one module, and these are the assertions
 * that fail when one of them moves.
 *
 * WHY THE MODULE IS A PLAIN .mjs. `admin.media.upload.ts` imports `~/db` and a
 * `.server` module, so it cannot be loaded by `node:test` without a bundler.
 * `upload-contract.mjs` imports nothing, which is the same reason
 * `media-ref-key.mjs` exists and is stated at its definition.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED,
  MAX_BYTES,
  UPLOAD_FORM_INTENT,
  UPLOAD_RETURN_PATH,
  beginsAsMarkup,
  isFormUpload,
  uploadErrorBody,
  uploadErrorSentence,
  uploadRedirectTo,
  uploadSuccessBody,
  validateUpload,
} from "../app/lib/media/upload-contract.mjs";

/** Bytes from a byte list, as an ArrayBuffer, which is what `validateUpload` takes. */
function buffer(...values) {
  return new Uint8Array(values).buffer;
}

/** A PNG's first eight bytes, so a passing case is a plausible image. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test("THE SUCCESS BODY: exactly url and key, and url is the public path", () => {
  const body = uploadSuccessBody("abc123.png");

  // Sorted, so adding a key fails here rather than passing on a lucky order.
  assert.deepEqual(Object.keys(body).sort(), ["key", "url"]);
  assert.equal(body.url, "/media/abc123.png");
  assert.equal(body.key, "abc123.png");
});

test("THE ERROR BODY: exactly error, carrying the sentence unchanged", () => {
  const body = uploadErrorBody("Unsupported image type \"application/zip\".");

  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error, 'Unsupported image type "application/zip".');
});

test("THE BRANCH IS AN EQUALITY, so the editors keep the JSON path", () => {
  assert.equal(isFormUpload(UPLOAD_FORM_INTENT), true);

  // Everything an editor could plausibly send, or not send, stays on JSON.
  // A truthiness test would put the first three on the redirect path and hand
  // an HTML document to `await response.json()`.
  for (const value of [undefined, null, "", "1", "true", "upload", "UPLOAD-FORM", " upload-form"]) {
    assert.equal(isFormUpload(value), false, `${JSON.stringify(value)} must not select the form branch`);
  }
});

test("THE REDIRECTS carry the key on success and a code on failure", () => {
  assert.equal(uploadRedirectTo({ ok: true, key: "abc123.png" }), `${UPLOAD_RETURN_PATH}?uploaded=abc123.png`);
  assert.equal(
    uploadRedirectTo({ ok: false, code: "too-large" }),
    `${UPLOAD_RETURN_PATH}?upload-error=too-large`,
  );

  // A key is a digest plus an extension today, but the encoder is what makes
  // that a property of the data rather than of the key scheme.
  assert.equal(
    uploadRedirectTo({ ok: true, key: "a b&c.png" }),
    `${UPLOAD_RETURN_PATH}?uploaded=a%20b%26c.png`,
  );
});

/* ------------------------------------------------------------------ *
 * THE SHARED REFUSAL, since 2026-09-07.
 * ------------------------------------------------------------------ *
 *
 * `validateUpload` is what `storeUpload` calls, and `storeUpload` is the ONE
 * door to MEDIA: the editor's route and the operator's `upload_media` are both
 * adapters over it. So these assertions are the whole statement of what the
 * bucket accepts, for both callers at once, and they are here rather than
 * against either caller because neither is loadable by `node:test`.
 */

test("VALIDATION ACCEPTS a plausible image of an allowed type", () => {
  // The accepting answer is null, and it is asserted explicitly: a refusal
  // object is truthy, so a caller's `if (refusal)` and this test agree.
  assert.equal(validateUpload({ type: "image/png", bytes: buffer(...PNG_MAGIC) }), null);
});

test("VALIDATION REFUSES a type outside the allowlist, naming what arrived", () => {
  const refusal = validateUpload({ type: "application/zip", bytes: buffer(0x50, 0x4b) });

  assert.equal(refusal.code, "unsupported-type");
  assert.equal(refusal.status, 415);
  // The sentence names the type, which is the half a query-string code cannot
  // carry and the half that tells an agent what to send instead.
  assert.match(refusal.message, /application\/zip/);

  // An empty type is what a multipart part carries when the browser could not
  // guess one, and "unknown" rather than an empty pair of quotes is the point.
  assert.match(validateUpload({ type: "", bytes: buffer(0) }).message, /"unknown"/);
});

test("VALIDATION REFUSES over MAX_BYTES, and the size reads as a size", () => {
  const refusal = validateUpload({
    type: "image/png",
    bytes: new ArrayBuffer(MAX_BYTES + 1),
  });

  assert.equal(refusal.code, "too-large");
  assert.equal(refusal.status, 413);
  // byteSize's MB form, not the five-figure kilobyte number this sentence
  // carried before it had an owner. Both halves of the comparison in MB.
  assert.match(refusal.message, /Image is 10\.0 MB, over the 10 MB limit\./);

  // EXACTLY at the limit is accepted: the rule is `>`, and a boundary asserted
  // only on the refusing side passes for an off-by-one in the safe direction
  // that silently costs a legitimate 10 MB upload.
  assert.equal(
    validateUpload({ type: "image/png", bytes: new ArrayBuffer(MAX_BYTES) }),
    null,
  );
});

test("VALIDATION REFUSES markup declared as a raster, which is the origin rule", () => {
  // Uploads land on this site's own origin. `media.$.ts` serves an SVG as an
  // attachment with nosniff and decides that from the STORED content type, so
  // SVG bytes stored as image/png escape it. Both callers can claim a type:
  // `file.type` on a multipart part is browser-supplied.
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const refusal = validateUpload({ type: "image/png", bytes: svg.buffer });

  assert.equal(refusal.code, "content-mismatch");
  assert.equal(refusal.status, 415);
  assert.match(refusal.message, /image\/png/);

  // The same bytes DECLARED HONESTLY are accepted. SVG is in the allowlist
  // deliberately and this check must not become a ban on it.
  assert.equal(validateUpload({ type: "image/svg+xml", bytes: svg.buffer }), null);
});

test("beginsAsMarkup sees past a BOM and whitespace, and stops there", () => {
  const encode = (text) => new TextEncoder().encode(text).buffer;

  assert.equal(beginsAsMarkup(encode("<svg/>")), true);
  assert.equal(beginsAsMarkup(encode("\n\t  <?xml version=\"1.0\"?>")), true);
  // A UTF-8 BOM is what a file saved out of a Windows editor carries, and three
  // bytes in front of the `<` would defeat the check entirely.
  assert.equal(beginsAsMarkup(buffer(0xef, 0xbb, 0xbf, 0x3c, 0x73)), true);

  // Every raster the allowlist accepts, by its own magic number. None of them
  // starts with `<`, which is what makes a false positive unavailable rather
  // than merely unlikely.
  assert.equal(beginsAsMarkup(buffer(...PNG_MAGIC)), false, "PNG");
  assert.equal(beginsAsMarkup(buffer(0xff, 0xd8, 0xff)), false, "JPEG");
  assert.equal(beginsAsMarkup(buffer(0x52, 0x49, 0x46, 0x46)), false, "WebP/RIFF");
  assert.equal(beginsAsMarkup(buffer(0x47, 0x49, 0x46, 0x38)), false, "GIF");
  assert.equal(beginsAsMarkup(buffer(0x00, 0x00, 0x00, 0x20, 0x66, 0x74)), false, "AVIF/ftyp");

  // Empty bytes are not markup. `view[at]` is undefined there, and `=== 0x3c`
  // is what makes that false rather than a comparison against NaN.
  assert.equal(beginsAsMarkup(new ArrayBuffer(0)), false);
  // Whitespace all the way to the end runs `at` off the array, same answer.
  assert.equal(beginsAsMarkup(buffer(0x20, 0x20, 0x20)), false);
});

test("EVERY REFUSAL validateUpload can return is a code the form can render", () => {
  /*
   * THE PAIRING, which is the one way these two can drift apart. `storeUpload`
   * hands the refusal's `message` to the JSON callers and its `code` to
   * `uploadRedirectTo`, and the library then resolves that code through
   * UPLOAD_ERRORS on arrival. A code with no sentence renders NOTHING on the
   * media page, on the one path that has no other way to say what went wrong.
   *
   * Driven off actual refusals rather than a written list, so a fourth one
   * added to `validateUpload` without a sentence fails here.
   */
  const svg = new TextEncoder().encode("<svg/>").buffer;
  const refusals = [
    validateUpload({ type: "application/zip", bytes: buffer(0x50, 0x4b) }),
    validateUpload({ type: "image/png", bytes: new ArrayBuffer(MAX_BYTES + 1) }),
    validateUpload({ type: "image/png", bytes: svg }),
  ];

  // The vacuity rule: the loop below is vacuous over an empty list, and every one
  // of these could start returning null without the assertions noticing.
  assert.equal(refusals.length, 3);
  for (const refusal of refusals) {
    assert.ok(refusal, "a refusing case returned the accepting answer");
    assert.ok(
      uploadErrorSentence(refusal.code),
      `${refusal.code} has no sentence in UPLOAD_ERRORS, so the media page renders nothing`,
    );
    assert.ok(refusal.status >= 400 && refusal.status < 500, `${refusal.code} status`);
  }
});

test("EVERY EMITTED CODE HAS A SENTENCE, and an unknown code has none", () => {
  for (const code of ["no-file", "unsupported-type", "too-large", "content-mismatch"]) {
    const sentence = uploadErrorSentence(code);
    assert.equal(typeof sentence, "string");
    assert.ok(sentence.length > 0, `${code} must say something`);
  }
  assert.equal(uploadErrorSentence("invented"), null);
  assert.equal(uploadErrorSentence(null), null);

  // Not inherited from Object.prototype: a lookup with `in` or a bare index
  // would answer "constructor" with a function.
  assert.equal(uploadErrorSentence("constructor"), null);
});

test("THE LIMITS the sentences are built from are the ones the route enforces", () => {
  assert.equal(MAX_BYTES, 10 * 1024 * 1024);
  assert.ok(uploadErrorSentence("too-large").includes("10 MB"));

  // The accepted set, as the page describes it. SVG is in it deliberately: the
  // bucket takes vectors, the Images binding simply cannot rasterise one.
  assert.deepEqual(
    [...ALLOWED.keys()].sort(),
    ["image/avif", "image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"],
  );
  assert.ok(uploadErrorSentence("unsupported-type").includes("svg+xml".split("/")[0]));
});

/* ------------------------------------------------------------------ *
 * THE ORIGIN INVARIANT: nothing user-writable may serve a script.
 * ------------------------------------------------------------------ *
 *
 * Uploads land on the SITE'S OWN ORIGIN, under `/media/*`. That makes this
 * allowlist a security boundary rather than a convenience: anything it accepts
 * is a file a third party can put on our origin and then link to.
 *
 * The invariant matters most to whatever `script-src` ends up being. A policy
 * that trusts the origin (`'self'`) is only as strong as the promise that the
 * origin cannot serve attacker-authored script. Recorded 2026-08-17 while
 * ruling on the CSP: the allowlist satisfies it today and must not drift.
 *
 * TWO TIERS, because they need different answers:
 *
 *   EXECUTABLE  a browser runs it straight from a URL. Never allowed, at all.
 *   CAPABLE     it can CARRY script (SVG, HTML, XML). Allowed only while it is
 *               served as an attachment, which `check:headers` asserts against
 *               `media.$.ts` because a unit test cannot read that route.
 *
 * SVG is the live case: it is in the allowlist deliberately, and it is safe
 * only because of the Content-Disposition fix. Deleting that fix without
 * removing SVG here reopens a stored-script path.
 */

/** Types a browser executes directly. The allowlist must never contain one. */
const EXECUTABLE_TYPES = [
  "application/javascript",
  "text/javascript",
  "application/ecmascript",
  "text/ecmascript",
  "application/x-javascript",
  "module",
  "application/wasm",
];

/** Extensions the same rule covers, since the map stores those too. */
const EXECUTABLE_EXTENSIONS = ["js", "mjs", "cjs", "jsx", "ts", "wasm", "html", "htm", "xhtml"];

/** Types that can CARRY script. Allowed only with the attachment mitigation. */
export const SCRIPT_CAPABLE_TYPES = ["image/svg+xml", "text/html", "application/xhtml+xml", "text/xml", "application/xml"];

test("the upload allowlist contains no directly executable type", () => {
  for (const type of ALLOWED.keys()) {
    assert.ok(
      !EXECUTABLE_TYPES.includes(type),
      `${type} is executable and must never be uploadable: uploads land on this origin`,
    );
  }
  for (const ext of ALLOWED.values()) {
    assert.ok(
      !EXECUTABLE_EXTENSIONS.includes(ext),
      `.${ext} is executable and must never be uploadable`,
    );
  }
});

test("the allowlist is non-empty, so the loop above is not vacuous", () => {
  // The vacuity rule: every per-entry assertion is vacuous over an empty map, and
  // an emptied allowlist would pass the check above while breaking uploads.
  assert.ok(ALLOWED.size >= 6, `allowlist has ${ALLOWED.size} entries`);
});

test("every script-CAPABLE allowed type is a known one with a mitigation", () => {
  // Not a ban: SVG is deliberately allowed. This fails when a NEW capable type
  // is added, so the attachment rule is extended in the same change rather than
  // silently left behind. check:headers asserts the route end of that pairing.
  const capable = [...ALLOWED.keys()].filter((t) => SCRIPT_CAPABLE_TYPES.includes(t));
  assert.deepEqual(
    capable,
    ["image/svg+xml"],
    "a script-capable type was added or removed; the Content-Disposition rule in " +
      "app/routes/media.$.ts must be updated to match, and check:headers asserts it",
  );
});
