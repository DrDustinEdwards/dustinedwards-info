import test from "node:test";
import assert from "node:assert/strict";

import { PUBLISHED_STATUS } from "@drdustinedwards/site-helpers/search";

import { statusForDraft } from "../app/lib/search/visibility.mjs";

await test("statusForDraft maps the artifact's boolean to the row's string", () => {
  assert.equal(statusForDraft(true), "draft");
  assert.equal(statusForDraft(false), PUBLISHED_STATUS);
  assert.equal(statusForDraft(undefined), PUBLISHED_STATUS, "absent means not a draft");
});
