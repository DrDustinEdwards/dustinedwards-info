/**
 * `readIntent()`: an absent intent is REFUSED, never defaulted to a save.
 *
 * Replays the live instance found in the 2026-08-07 audit.
 * `app/lib/editor/action.server.ts` read the field as
 * `String(form.get("intent") ?? "save")`, so a POST that named no intent
 * performed a WRITE: a commit to GitHub and a D1 sync, from a request that
 * never said what it wanted.
 *
 * This is the no-substitution rule on its worst surface. A substituting fallback on a LABEL
 * renders the wrong word; a substituting fallback on an ACTION does the wrong
 * thing to the repository. The colophon defect and this one are the same shape
 * and are not the same severity.
 *
 * The refusal is only safe because every legitimate submitter names its intent.
 * That was checked before the default was removed, not after: four save
 * controls in `publish-actions.tsx`, one preview control in `post-editor.tsx`,
 * one delete control in the edit route, and the Cmd+S shortcut, which submits
 * with NO submitter and now enables a hidden `intent=save` field for exactly
 * one submit. `check:admin-ui` stayed at 144 checks across that change, which
 * confirms the disabled-at-rest field never enters an ordinary submission set.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readIntent } from "../app/lib/editor/intent.mjs";

/** A minimal stand-in with the one method the reader uses. */
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
  // `form.get()` returns File | string | null. String(file) is "[object File]",
  // which is not an intent and must not reach the action's dispatch.
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
  // Refusing here would move the dispatch decision into the reader. The action
  // owns what a named-but-unrecognised intent does; this function only answers
  // whether the submission named one at all.
  assert.equal(readIntent(formWith({ intent: "wibble" })), "wibble");
});
