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

function buffer(...values) {
  return new Uint8Array(values).buffer;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test("THE SUCCESS BODY: exactly url and key, and url is the public path", () => {
  const body = uploadSuccessBody("abc123.png");

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

  assert.equal(
    uploadRedirectTo({ ok: true, key: "a b&c.png" }),
    `${UPLOAD_RETURN_PATH}?uploaded=a%20b%26c.png`,
  );
});

test("VALIDATION ACCEPTS a plausible image of an allowed type", () => {
  assert.equal(validateUpload({ type: "image/png", bytes: buffer(...PNG_MAGIC) }), null);
});

test("VALIDATION REFUSES a type outside the allowlist, naming what arrived", () => {
  const refusal = validateUpload({ type: "application/zip", bytes: buffer(0x50, 0x4b) });

  assert.equal(refusal.code, "unsupported-type");
  assert.equal(refusal.status, 415);
  assert.match(refusal.message, /application\/zip/);

  assert.match(validateUpload({ type: "", bytes: buffer(0) }).message, /"unknown"/);
});

test("VALIDATION REFUSES over MAX_BYTES, and the size reads as a size", () => {
  const refusal = validateUpload({
    type: "image/png",
    bytes: new ArrayBuffer(MAX_BYTES + 1),
  });

  assert.equal(refusal.code, "too-large");
  assert.equal(refusal.status, 413);
  assert.match(refusal.message, /Image is 10\.0 MB, over the 10 MB limit\./);

  // Exactly at the limit is accepted: the rule is `>`, and a refusing-side-only
  // assertion would miss an off-by-one that costs a legitimate 10 MB upload.
  assert.equal(
    validateUpload({ type: "image/png", bytes: new ArrayBuffer(MAX_BYTES) }),
    null,
  );
});

test("VALIDATION REFUSES markup declared as a raster, which is the origin rule", () => {
  // `media.$.ts` serves SVG as an attachment based on the STORED content type,
  // so SVG bytes stored as image/png would escape it.
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const refusal = validateUpload({ type: "image/png", bytes: svg.buffer });

  assert.equal(refusal.code, "content-mismatch");
  assert.equal(refusal.status, 415);
  assert.match(refusal.message, /image\/png/);

  // SVG is allowlisted deliberately; this check must not become a ban on it.
  assert.equal(validateUpload({ type: "image/svg+xml", bytes: svg.buffer }), null);
});

test("beginsAsMarkup sees past a BOM and whitespace, and stops there", () => {
  const encode = (text) => new TextEncoder().encode(text).buffer;

  assert.equal(beginsAsMarkup(encode("<svg/>")), true);
  assert.equal(beginsAsMarkup(encode("\n\t  <?xml version=\"1.0\"?>")), true);
  // A UTF-8 BOM (from a Windows editor) in front of the `<` would defeat the check.
  assert.equal(beginsAsMarkup(buffer(0xef, 0xbb, 0xbf, 0x3c, 0x73)), true);

  assert.equal(beginsAsMarkup(buffer(...PNG_MAGIC)), false, "PNG");
  assert.equal(beginsAsMarkup(buffer(0xff, 0xd8, 0xff)), false, "JPEG");
  assert.equal(beginsAsMarkup(buffer(0x52, 0x49, 0x46, 0x46)), false, "WebP/RIFF");
  assert.equal(beginsAsMarkup(buffer(0x47, 0x49, 0x46, 0x38)), false, "GIF");
  assert.equal(beginsAsMarkup(buffer(0x00, 0x00, 0x00, 0x20, 0x66, 0x74)), false, "AVIF/ftyp");

  assert.equal(beginsAsMarkup(new ArrayBuffer(0)), false);
  assert.equal(beginsAsMarkup(buffer(0x20, 0x20, 0x20)), false);
});

test("EVERY REFUSAL validateUpload can return is a code the form can render", () => {
  const svg = new TextEncoder().encode("<svg/>").buffer;
  const refusals = [
    validateUpload({ type: "application/zip", bytes: buffer(0x50, 0x4b) }),
    validateUpload({ type: "image/png", bytes: new ArrayBuffer(MAX_BYTES + 1) }),
    validateUpload({ type: "image/png", bytes: svg }),
  ];

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

// Uploads land on the site's own origin, so this allowlist is a security boundary.
// SVG can carry script and is safe only because `media.$.ts` serves it as an attachment.

const EXECUTABLE_TYPES = [
  "application/javascript",
  "text/javascript",
  "application/ecmascript",
  "text/ecmascript",
  "application/x-javascript",
  "module",
  "application/wasm",
];

const EXECUTABLE_EXTENSIONS = ["js", "mjs", "cjs", "jsx", "ts", "wasm", "html", "htm", "xhtml"];

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
