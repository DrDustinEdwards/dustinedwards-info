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
  // Hard rule 10: every per-entry assertion is vacuous over an empty map, and
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
