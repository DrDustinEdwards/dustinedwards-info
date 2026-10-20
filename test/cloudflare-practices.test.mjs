// Two Cloudflare best-practice settings that a quiet edit would undo (job_ea530dc4daf6). Both are
// read from source, since the property is a choice of primitive or a stated value.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { stripComments } from "../scripts/lib/strip-comments.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

await test("the bearer compares are site-runtime's safeEqual, and no hand-written compare came back", () => {
  // safeEqual (site-runtime/compare) hashes both sides and compares with crypto.subtle.timingSafeEqual in workerd.
  for (const path of ["app/lib/operator/auth.server.ts", "app/lib/smoke.server.ts"]) {
    const code = stripComments(read(path));
    assert.match(code, /from "@dustinedwards\/site-runtime\/compare"/, `${path} must import the shared compare`);
    assert.match(code, /await safeEqual\(presented, configured\)/, `${path} must compare the token with safeEqual`);
  }
  const bearer = stripComments(read("app/lib/bearer.server.ts"));
  assert.doesNotMatch(bearer, /timingSafeEqual|diff\s*\|=|crypto\.subtle/, "a local copy of the compare came back");
});

await test("observability states head_sampling_rate rather than inheriting the default", () => {
  const code = stripComments(read("wrangler.jsonc.example"));
  assert.match(code, /"head_sampling_rate":\s*1\b/);
});
