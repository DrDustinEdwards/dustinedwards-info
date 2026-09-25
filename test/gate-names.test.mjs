/**
 * check-all and check-changed run the gates this lists, so an empty list passed by running nothing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { gateNames } from "../scripts/build-stack.mjs";

test("gates are the check: scripts, minus the runners, sorted", () => {
  const pkg = { scripts: { "check:b": "", "check:a": "", "check:all": "", build: "" } };
  assert.deepEqual(gateNames(pkg), ["check:a", "check:b"]);
});

test("REPLAY: a package with no scripts, or no gates, throws rather than listing none", () => {
  for (const pkg of [{}, { scripts: {} }, { scripts: { build: "", "check:ci": "" } }, null]) {
    assert.throws(() => gateNames(pkg), /declares no check: gates/, JSON.stringify(pkg));
  }
});
