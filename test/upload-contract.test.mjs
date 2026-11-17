import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCEPT_ATTRIBUTE,
  ALLOWED,
  MAX_BYTES,
  uploadErrorSentence,
  validateUpload,
} from "../app/lib/media/upload-contract.mjs";

function buffer(...values) {
  return new Uint8Array(values).buffer;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

await test("VALIDATION ACCEPTS a plausible image of an allowed type", () => {
  assert.equal(validateUpload({ type: "image/png", bytes: buffer(...PNG_MAGIC) }), null);
});

await test("VALIDATION REFUSES a type outside the allowlist, naming what arrived", () => {
  const refusal = validateUpload({ type: "application/zip", bytes: buffer(0x50, 0x4b) });

  assert.equal(refusal.code, "unsupported-type");
  assert.equal(refusal.status, 415);
  assert.match(refusal.message, /application\/zip/);

  assert.match(validateUpload({ type: "", bytes: buffer(0) }).message, /"unknown"/);
});

await test("VALIDATION REFUSES over MAX_BYTES, and the size reads as a size", () => {
  const refusal = validateUpload({
    type: "image/png",
    bytes: new ArrayBuffer(MAX_BYTES + 1),
  });

  assert.equal(refusal.code, "too-large");
  assert.equal(refusal.status, 413);
  assert.match(refusal.message, /The file is 10\.0 MB, over the 10 MB limit\./);

  // Exactly at the limit is accepted: the rule is `>`, and a refusing-side-only
  // assertion would miss an off-by-one that costs a legitimate 10 MB upload.
  assert.equal(validateUpload({ type: "image/png", bytes: new ArrayBuffer(MAX_BYTES) }), null);
});

await test("VALIDATION REFUSES SVG by name, with a sentence that says why and what to do", () => {
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  );
  const refusal = validateUpload({ type: "image/svg+xml", bytes: svg.buffer });

  assert.ok(refusal, "an SVG upload was accepted");
  assert.equal(refusal.code, "svg-refused");
  assert.equal(refusal.status, 415);
  assert.match(refusal.message, /SVG is not accepted/);
  assert.match(refusal.message, /script/);
  assert.match(refusal.message, /PNG or WebP/);
  assert.equal(uploadErrorSentence("svg-refused"), refusal.message);

  // Case and parameters do not slip it past as an unknown type with a vaguer message.
  assert.equal(validateUpload({ type: "Image/SVG+XML", bytes: svg.buffer }).code, "svg-refused");
  assert.equal(
    validateUpload({ type: "image/svg+xml; charset=utf-8", bytes: svg.buffer }).code,
    "svg-refused",
  );
});

await test("SVG is in neither the allowlist nor the picker's accept attribute", () => {
  assert.equal(ALLOWED.has("image/svg+xml"), false);
  assert.ok(![...ALLOWED.values()].includes("svg"));
  assert.doesNotMatch(ACCEPT_ATTRIBUTE, /svg/);
  assert.doesNotMatch(uploadErrorSentence("unsupported-type"), /svg/);
});

// Uploads land on the site's own origin, so this allowlist is a security boundary.
// SVG can carry script and is refused at upload; a stored one is still attached and sandboxed.

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

await test("the upload allowlist contains no directly executable type", () => {
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
