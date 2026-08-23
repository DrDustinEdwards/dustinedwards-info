/**
 * The one JavaScript owner of "is this post publicly visible".
 *
 * REPLAYS THE DEFECT, per hard rule 12. On 2026-07-29 five unpublished drafts
 * staged through the operator path were uploaded to Ask unconditionally, and the
 * public endpoint answered from one and cited it by slug. The cause was that Ask
 * had its OWN copy of the visibility rule, agreeing with `publiclyVisible()` by
 * inspection and by a grep and by nothing else.
 *
 * The write-quality audit, finding 5: "A fourth shape is how unpublished drafts
 * entered Ask in July. The two-language pair is gated. This third is a grep."
 * Verified at HEAD before the fix: three copies, the Ask one hand-rolled.
 *
 * Each test below flips ONE fact and asserts inclusion flips with it, which is
 * what proves the predicate reads both facts rather than happening to agree.
 *
 * @see app/lib/search/visibility.mjs
 */

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

/* ------------------------------------------------ the two excluded shapes */

test("A DRAFT IS EXCLUDED, which is the July leak", () => {
  assert.equal(
    isPubliclyVisible({ status: "draft", publishAt: PAST }, NOW),
    false,
    "a draft with a past publish date must still be excluded",
  );
});

test("A FUTURE-DATED POST IS EXCLUDED", () => {
  assert.equal(
    isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt: FUTURE }, NOW),
    false,
    "published but not yet due must be excluded",
  );
});

/* ---------------------------------- flip each fact, inclusion flips with it */

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

test("BOTH facts are required: neither alone admits a post", () => {
  // The failure this catches is a predicate that reads one fact and happens to
  // agree with the other on today's corpus.
  assert.equal(isPubliclyVisible({ status: "draft", publishAt: FUTURE }, NOW), false);
  assert.equal(isPubliclyVisible({ status: PUBLISHED_STATUS, publishAt: PAST }, NOW), true);
});

/* -------------------------------------------------------------- the edges */

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

/* ------------------------------------------------------------ the mapping */

test("statusForDraft maps the artifact's boolean to the row's string", () => {
  // The editor writes `record.draft ? "draft" : "published"`. This is the same
  // fact in the other shape, stated once so Ask can ask the shared predicate.
  assert.equal(statusForDraft(true), "draft");
  assert.equal(statusForDraft(false), PUBLISHED_STATUS);
  assert.equal(statusForDraft(undefined), PUBLISHED_STATUS, "absent means not a draft");
});

test("the Ask mapping composed end to end excludes exactly the two shapes", () => {
  // What ask.server.ts actually does, spelled out: map draft to status, then ask
  // the shared predicate.
  const askVisible = (post) =>
    isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt }, NOW);

  assert.equal(askVisible({ draft: true, publishAt: PAST }), false, "draft excluded");
  assert.equal(askVisible({ draft: false, publishAt: FUTURE }), false, "future excluded");
  assert.equal(askVisible({ draft: false, publishAt: PAST }), true, "live included");
  assert.equal(askVisible({ publishAt: PAST }), true, "no draft flag means not a draft");
});
