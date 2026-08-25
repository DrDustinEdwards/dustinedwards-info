/**
 * The Contents API cap guard, driven with the stubbed responses GitHub
 * actually sends.
 *
 * WHAT THIS PROTECTS. The JSON media type returns a file over 1 MB with
 * `size` set and no base64 content. `readFile` used to decode that to an
 * empty string, so an oversized artifact surfaced as "not valid JSON" with
 * advice to run build:content, a repair that repairs nothing. The decision is
 * pure in artifact-limits.mjs precisely so this file can drive it without a
 * GitHub binding; github.server.ts turns a non-null message into a
 * GitHubError.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTIFACT_READ_CEILING_BYTES,
  contentsCapMessage,
} from "../app/lib/editor/artifact-limits.mjs";

test("a capped response throws the cap message, naming the path and the limit", () => {
  // The shape GitHub documents for a file over 1 MB on the JSON media type:
  // size present, content empty, encoding "none".
  const message = contentsCapMessage(
    { size: 2000000, content: "", encoding: "none" },
    "content/generated/posts.json",
  );
  assert.ok(message, "a 2000000 byte response with no base64 content must be refused");
  assert.match(message, /content\/generated\/posts\.json/);
  assert.match(message, /2000000 bytes/);
  assert.match(message, /1 MB/);
  assert.match(message, /readRawFile/, "the message names the repair, not just the failure");
});

test("base64 content with no bytes dropped passes untouched", () => {
  const ok = contentsCapMessage(
    { size: 1234, content: "aGVsbG8=", encoding: "base64" },
    "content/posts/a-post.md",
  );
  assert.equal(ok, null);
});

test("an empty file is readable, not capped", () => {
  // A zero-byte tracked file comes back size 0 with empty base64 content.
  // The guard keys on size above zero, so absence of content bytes here is
  // the truth about the file rather than a transport failure.
  const ok = contentsCapMessage(
    { size: 0, content: "", encoding: "base64" },
    "content/posts/empty.md",
  );
  assert.equal(ok, null);
});

test("the ceiling is GitHub's documented raw limit", () => {
  // Restated as arithmetic rather than a digit so this file is not a second
  // copy of the number: 100 binary megabytes.
  assert.equal(ARTIFACT_READ_CEILING_BYTES, 100 * 1024 * 1024);
});
