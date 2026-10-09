// Two Cloudflare best-practice settings that a quiet edit would undo (job_ea530dc4daf6). Both are
// read from source, since the property is a choice of primitive or a stated value.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { stripComments } from "../scripts/lib/strip-comments.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the bearer compare uses timingSafeEqual and carries no hand-written loop", () => {
  const code = stripComments(read("app/lib/bearer.server.ts"));
  assert.match(code, /timingSafeEqual\(/, "the compare must go through the runtime's timingSafeEqual");
  assert.doesNotMatch(code, /diff\s*\|=/, "a hand-written XOR loop came back");
});

test("observability states head_sampling_rate rather than inheriting the default", () => {
  const code = stripComments(read("wrangler.jsonc.example"));
  assert.match(code, /"head_sampling_rate":\s*1\b/);
});
