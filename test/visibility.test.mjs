import test from "node:test";
import assert from "node:assert/strict";

import {
  PUBLISHED_STATUS,
  isPubliclyVisible,
  statusForDraft,
} from "../app/lib/search/visibility.mjs";

const NOW = Date.parse("2026-08-23T12:00:00Z");
const PAST = "2026-08-01T00:00:00Z";
const FUTURE = "2026-12-01T00:00:00Z";

test("A DRAFT IS EXCLUDED, which is the July leak", () => {
  assert.equal(
    isPubliclyVisible({ status: "draft", publishAt: PAST }, NOW),
    false,
    "a draft with a past publish date must still be excluded",
  );
  // Neither fact holding must not admit a post either: an equality of the two facts would pass
  // both flip tests below and still publish a future-dated draft.
  assert.equal(isPubliclyVisible({ status: "draft", publishAt: FUTURE }, NOW), false);
});

test("A FUTURE-DATED POST IS EXCLUDED", () => {
  assert.equal(
    isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt: FUTURE }, NOW),
    false,
    "published but not yet due must be excluded",
  );
});

test("FLIP THE STATUS: draft to published, with the date held, flips inclusion", () => {
  const held = { publishAt: PAST };
  assert.equal(isPubliclyVisible({ ...held, status: "draft" }, NOW), false);
  assert.equal(isPubliclyVisible({ ...held, status: PUBLISHED_STATUS }, NOW), true);
});

test("FLIP THE DATE: future to past, with the status held, flips inclusion", () => {
  const held = { status: PUBLISHED_STATUS };
  assert.equal(isPubliclyVisible({ ...held, publishAt: FUTURE }, NOW), false);
  assert.equal(isPubliclyVisible({ ...held, publishAt: PAST }, NOW), true);
});

test("no publish date means publish immediately, not never", () => {
  // The Drizzle form is isNull(publishAt) OR publishAt <= now. Reading a missing
  // date as a reason to EXCLUDE would hide every post that never set one.
  for (const publishAt of [null, undefined, ""]) {
    assert.equal(
      isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt }, NOW),
      true,
      `publishAt ${JSON.stringify(publishAt)} must not exclude`,
    );
  }
});

test("the boundary is inclusive: a date exactly now is visible", () => {
  assert.equal(isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt: NOW }, NOW), true);
  assert.equal(isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt: NOW + 1 }, NOW), false);
});

test("FAIL CLOSED: an unparseable date is not yet visible", () => {
  // A date this cannot read is a date this cannot prove has passed, and on the
  // Ask upload path being wrong the other way is a draft answering the public.
  assert.equal(
    isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt: "not a date" }, NOW),
    false,
  );
});

test("a Date object and an epoch number are read the same as a string", () => {
  const shapes = [PAST, new Date(PAST), Date.parse(PAST)];
  for (const publishAt of shapes) {
    assert.equal(isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt }, NOW), true);
  }
});

test("statusForDraft maps the artifact's boolean to the row's string", () => {
  assert.equal(statusForDraft(true), "draft");
  assert.equal(statusForDraft(false), PUBLISHED_STATUS);
  assert.equal(statusForDraft(undefined), PUBLISHED_STATUS, "absent means not a draft");
});
