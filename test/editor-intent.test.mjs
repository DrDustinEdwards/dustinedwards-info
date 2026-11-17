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

await test("THE DEFECT: a submission naming no intent is REFUSED, not saved", () => {
  assert.equal(readIntent(formWith({})), null);
  assert.equal(
    readIntent(formWith({ slug: "a-post", body: "text" })),
    null,
    "a form carrying real fields but no intent must still be refused",
  );
});

await test("a non-string value is refused rather than coerced", () => {
  // `String(file)` is "[object File]", which must not reach the action's dispatch.
  assert.equal(readIntent(formWith({ intent: new Blob(["x"]) })), null);
  assert.equal(readIntent(formWith({ intent: 0 })), null);
  assert.equal(readIntent(formWith({ intent: null })), null);
});
