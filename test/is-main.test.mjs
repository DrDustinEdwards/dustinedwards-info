/**
 * Every build writer runs only behind this guard, so a guard that misses exits 0 having written
 * nothing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isMain } from "../scripts/lib/is-main.mjs";

const HERE = fileURLToPath(import.meta.url);

test("a module is main when it is the started script", () => {
  assert.equal(isMain(import.meta.url, HERE), true);
});

test("another module is not main", () => {
  const other = pathToFileURL(fileURLToPath(new URL("../package.json", import.meta.url))).href;
  assert.equal(isMain(other, HERE), false);
});

test("no started script is not main", () => {
  assert.equal(isMain(import.meta.url, ""), false);
});

const windowsOnly = { skip: process.platform !== "win32" };

test("REPLAY: a drive letter in the other case still matches on Windows", windowsOnly, () => {
  const flipped = HERE[0] === HERE[0].toUpperCase()
    ? HERE[0].toLowerCase() + HERE.slice(1)
    : HERE[0].toUpperCase() + HERE.slice(1);
  assert.equal(isMain(import.meta.url, flipped), true);
});
