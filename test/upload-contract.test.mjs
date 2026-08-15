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
  isFormUpload,
  uploadErrorBody,
  uploadErrorSentence,
  uploadRedirectTo,
  uploadSuccessBody,
} from "../app/lib/media/upload-contract.mjs";

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

test("EVERY EMITTED CODE HAS A SENTENCE, and an unknown code has none", () => {
  for (const code of ["no-file", "unsupported-type", "too-large"]) {
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
