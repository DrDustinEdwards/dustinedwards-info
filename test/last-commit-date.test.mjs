/**
 * A failed git call used to read as "no history", which sync:content then wrote to D1 as a null
 * revision date over every real one.
 */

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { lastCommitDate } from "../scripts/build-content.mjs";

test("a tracked file reads its last commit date", () => {
  assert.match(lastCommitDate("package.json") ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("a file git has no history for is the null answer", () => {
  assert.equal(lastCommitDate("content/posts/no-such-post-ever.md"), null);
});

test("REPLAY: a git failure throws instead of reading as no history", () => {
  // Outside the repository, git exits nonzero, the same shape as git missing or a broken checkout.
  const outside = path.join(os.tmpdir(), "not-in-this-repo.md");
  assert.throws(() => lastCommitDate(outside), /git log could not read the history/);
});
