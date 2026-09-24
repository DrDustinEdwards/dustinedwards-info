import test from "node:test";
import assert from "node:assert/strict";

import { byteSize } from "../app/lib/media/byte-size.mjs";

test("the three bands", () => {
  assert.equal(byteSize(812), "812 B");
  assert.equal(byteSize(42000), "41 kB");
  assert.equal(byteSize(10_500_000), "10.0 MB");
});

test("the boundaries land in the band above, not below", () => {
  assert.equal(byteSize(1023), "1023 B");
  assert.equal(byteSize(1024), "1 kB");
  assert.equal(byteSize(1024 * 1024 - 1), "1024 kB");
  assert.equal(byteSize(1024 * 1024), "1.0 MB");
});

test("zero is a size, not an absence", () => {
  assert.equal(byteSize(0), "0 B");
});

test("MB carries one decimal, so two nearby files do not read identically", () => {
  // The MB band uses toFixed(1): the media page lists derivatives of one original, and whole
  // megabytes would show a column of the same number.
  assert.notEqual(byteSize(2_400_000), byteSize(2_600_000));
});
