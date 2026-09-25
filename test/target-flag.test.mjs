/**
 * build:og used to default to --remote, so a bare run wrote and pruned production R2. The target is
 * now named on every run that touches R2.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { requireTarget } from "../scripts/lib/target-flag.mjs";

test("REPLAY: no target is refused, not defaulted to production", () => {
  assert.throws(() => requireTarget([], "build:og"), /needs an explicit target/);
  assert.throws(() => requireTarget(["--dry-run"], "build:og"), /Nothing was touched/);
});

test("both targets at once are refused", () => {
  assert.throws(() => requireTarget(["--remote", "--local"], "build:og"), /both --remote and --local/);
});

test("a named target is returned as given", () => {
  assert.equal(requireTarget(["--remote"], "build:og"), "--remote");
  assert.equal(requireTarget(["--dry-run", "--local"], "build:og"), "--local");
});
