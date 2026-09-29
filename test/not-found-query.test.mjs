import test from "node:test";
import assert from "node:assert/strict";

import { notFoundQuery } from "../app/lib/not-found-query.mjs";

test("the words of the last segment, with a dated address's numbers and a file extension dropped", () => {
  assert.equal(notFoundQuery("/2019/05/phage-isolation-protocol/"), "phage isolation protocol");
  assert.equal(notFoundQuery("/old_notes/Lambda-Phage.html"), "Lambda Phage");
  assert.equal(notFoundQuery("/research/t4-genome"), "t4 genome");
});

test("nothing when no word is left, so the box shows its placeholder", () => {
  assert.equal(notFoundQuery("/"), "");
  assert.equal(notFoundQuery("/2019/05/"), "");
});

test("a malformed percent escape is dropped rather than thrown", () => {
  assert.equal(notFoundQuery("/caf%E9-%ZZnotes"), "caf ZZnotes");
});

test("capped, so a long address cannot fill the box", () => {
  assert.ok(notFoundQuery(`/${"word-".repeat(50)}`).length <= 100);
});
