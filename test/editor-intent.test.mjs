/**
 * Refusing an absent intent is safe only because every legitimate submitter names one; Cmd+S
 * submits with no submitter, so it enables a hidden `intent=save` field for that one submit.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readIntent } from "../app/lib/editor/intent.mjs";

const formWith = (entries) => ({
  get: (name) => (name in entries ? entries[name] : null),
});

test("THE DEFECT: a submission naming no intent is REFUSED, not saved", () => {
  assert.equal(readIntent(formWith({})), null);
  assert.equal(
    readIntent(formWith({ slug: "a-post", body: "text" })),
    null,
    "a form carrying real fields but no intent must still be refused",
  );
});

test("an empty intent is refused, not treated as a save", () => {
  assert.equal(readIntent(formWith({ intent: "" })), null);
});

test("a non-string value is refused rather than coerced", () => {
  // `String(file)` is "[object File]", which must not reach the action's dispatch.
  assert.equal(readIntent(formWith({ intent: new Blob(["x"]) })), null);
  assert.equal(readIntent(formWith({ intent: 0 })), null);
  assert.equal(readIntent(formWith({ intent: null })), null);
});

test("every real control's intent passes through unchanged", () => {
  for (const intent of ["save", "preview", "delete", "regenerate", "sync-ask"]) {
    assert.equal(readIntent(formWith({ intent })), intent);
  }
});

test("an UNKNOWN intent is returned, not refused", () => {
  // The action owns what an unrecognised intent does; this only answers whether one was named.
  assert.equal(readIntent(formWith({ intent: "wibble" })), "wibble");
});
