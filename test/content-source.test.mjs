import assert from "node:assert/strict";
import { test } from "node:test";

import { isSourcePath } from "../scripts/lib/content-source.mjs";

test("a source path is a plain path under a source directory", () => {
  assert.ok(isSourcePath("content/posts/a-post.md"));
  assert.ok(isSourcePath("content/llms.txt"));
  for (const bad of [
    "content/posts/../../.github/workflows/x.yml",
    "/content/posts/a.md",
    'content/posts/a"b.md',
    "content\\posts\\a.md",
    "content/posts/$(x).md",
    "src/a.md",
  ])
    assert.equal(isSourcePath(bad), false, bad);
});
