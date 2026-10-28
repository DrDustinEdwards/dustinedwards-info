import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { UI_FILE, sha256 } from "../scripts/build-ui-advances.mjs";
import { UI_SHA256 } from "../app/lib/ui-advances.generated.ts";
import { uiWidthEm } from "../app/lib/ui-width.ts";

await test("the advance table was measured from the UI face the site serves", () => {
  assert.equal(
    sha256(readFileSync(UI_FILE)),
    UI_SHA256,
    "capsomer/fonts/schibsted-grotesk-latin-wght-normal.woff2 changed; run npm run build:ui-advances and commit the table",
  );
});

await test("a character outside the table widens the box rather than vanishing from it", () => {
  // A tag like "café" must not get a box narrower than its text, or the row wraps on the swap again.
  assert.ok(uiWidthEm("café", 400) > uiWidthEm("caf", 400) + uiWidthEm("e", 400));
});
