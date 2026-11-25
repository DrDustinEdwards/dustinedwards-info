/**
 * Every build writer runs only behind this guard, so a guard that misses exits 0 having written
 * nothing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { isMain } from "../scripts/lib/is-main.mjs";

const HERE = fileURLToPath(import.meta.url);

await test("a module is main when it is the started script", () => {
  assert.equal(isMain(import.meta.url, HERE), true);
});
