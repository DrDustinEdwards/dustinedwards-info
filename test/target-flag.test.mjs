/**
 * build:og used to default to --remote, so a bare run wrote and pruned production R2. The target is
 * now named on every run that touches R2.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { requireTarget } from "../scripts/lib/target-flag.mjs";

await test("REPLAY: no target is refused, not defaulted to production", () => {
  assert.throws(() => requireTarget([], "build:og"), /needs an explicit target/);
  assert.throws(() => requireTarget(["--dry-run"], "build:og"), /Nothing was touched/);
});

await test("both targets at once are refused", () => {
  assert.throws(
    () => requireTarget(["--remote", "--local"], "build:og"),
    /both --remote and --local/,
  );
});
