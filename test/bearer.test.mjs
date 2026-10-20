// The token label. The compare is site-runtime's safeEqual (site-runtime/compare), tested there.

import test from "node:test";
import assert from "node:assert/strict";

import { tokenLabel } from "../app/lib/bearer.server.ts";

await test("tokenLabel is stable, fixed width, and moves when the token does", () => {
  const label = tokenLabel("operator-token-value");
  assert.equal(label, tokenLabel("operator-token-value"), "not stable across calls");
  assert.match(label, /^[0-9a-f]{8}$/, "not eight lowercase hex characters");
  assert.notEqual(
    label,
    tokenLabel("operator-token-value-rotated"),
    "a rotated token produced the same label, so the label cannot identify a holder",
  );
  assert.notEqual(label, "operator-token-value", "the label is the token");
});

await test("tokenLabel labels the empty string without throwing", () => {
  assert.match(tokenLabel(""), /^[0-9a-f]{8}$/);
});
