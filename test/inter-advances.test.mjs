import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { INTER_FILE, sha256 } from "../scripts/build-inter-advances.mjs";
import { INTER_SHA256 } from "../app/lib/inter-advances.generated.ts";
import { interWidthEm } from "../app/lib/inter-width.ts";

test("the advance table was measured from the Inter file the site serves", () => {
  assert.equal(
    sha256(readFileSync(INTER_FILE)),
    INTER_SHA256,
    "app/fonts/inter-latin-normal.woff2 changed; run npm run build:inter-advances and commit the table",
  );
});

test("a character outside the table widens the box rather than vanishing from it", () => {
  // A tag like "café" must not get a box narrower than its text, or the row wraps on the swap again.
  assert.ok(interWidthEm("café", 400) > interWidthEm("caf", 400) + interWidthEm("e", 400));
});
