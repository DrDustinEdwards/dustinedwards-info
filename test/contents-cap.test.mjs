/**
 * The Contents API cap guard, without a GitHub binding in sight.
 *
 * Replays the misdiagnosis the guard was written for: the JSON media type
 * returns a file over 1 MB with `size` set and NO base64 content, and the
 * reader used to decode that to an empty string, surfacing downstream as
 * parse garbage with advice that repaired nothing.
 *
 * Trimmed from test/artifact-limits.test.mjs when the artifact-sized readers
 * were deleted; the cap survives because it governs every per-file read.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { contentsCapMessage } from "../app/lib/editor/contents-cap.mjs";

test("a capped response produces a message naming the transport", () => {
  const message = contentsCapMessage(
    { size: 1_200_000, content: "", encoding: "none" },
    "content/posts/enormous.md",
  );
  assert.ok(message, "an over-cap response must be refused");
  assert.match(message, /1 MB/, "the message names the cap");
  assert.match(message, /content\/posts\/enormous\.md/, "the message names the file");
});

test("an ordinary base64 response passes", () => {
  const ok = contentsCapMessage(
    { size: 4096, content: "aGVsbG8=", encoding: "base64" },
    "content/posts/fine.md",
  );
  assert.equal(ok, null);
});

test("a zero-size response passes, because absent content is not capped content", () => {
  const ok = contentsCapMessage({ size: 0, content: "", encoding: "none" }, "content/posts/empty.md");
  assert.equal(ok, null);
});
