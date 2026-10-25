import test from "node:test";
import assert from "node:assert/strict";

import { isAbandonedTransition } from "../app/lib/transition-abort.mjs";

/* The one rejection the header lets go (app/lib/transition-abort.mjs): the browser abandoning a view transition. */

await test("the abandoned-transition error is recognized", () => {
  const error = new DOMException("Transition was aborted because of invalid state", "InvalidStateError");
  assert.equal(isAbandonedTransition(error), true);
});

await test("every other rejection is still a failure: another InvalidStateError, another DOMException, an Error, a string", () => {
  assert.equal(isAbandonedTransition(new DOMException("The object is in an invalid state", "InvalidStateError")), false);
  assert.equal(isAbandonedTransition(new DOMException("Transition was aborted because of invalid state", "AbortError")), false);
  assert.equal(isAbandonedTransition(new Error("Transition was aborted because of invalid state")), false);
  assert.equal(isAbandonedTransition("Transition was aborted"), false);
  assert.equal(isAbandonedTransition(undefined), false);
});
