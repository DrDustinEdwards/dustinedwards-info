/**
 * The retraction path, driven with a real retracted DOI.
 *
 * ## WHY A FIXTURE AND NOT A RECORD
 *
 * Nothing in this corpus is retracted or corrected. Measured 2026-09-12 across
 * all 34 Crossref DOIs: no `updated-by`, no `update-to`, no `relation` of any
 * kind. So the render path has no data behind it, and a path nothing exercises
 * is a path that does not work. The replay rule says a new path is tested by
 * REPLAYING the case it was written for, and the only way to do that here is a
 * case from outside.
 *
 * The fixture is `10.1016/S0140-6736(97)11096-0`, the 1998 Lancet paper linking
 * MMR to autism, retracted in full on 2010-02-02. It is chosen because it is
 * the most thoroughly documented retraction in the literature, so the fixture
 * cannot quietly become wrong, and because it is unambiguously not one of ours:
 * a fixture drawn from this corpus would go stale the moment the corpus moved,
 * and would read as a claim about a real paper here.
 *
 * The DOI in a notice is the NOTICE's DOI. This test uses the retracted
 * paper's own DOI as the stand-in identifier, because what is under test is the
 * shape and the sentence rather than the bibliography of that retraction.
 *
 * @see app/lib/publications/update-notice.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  UPDATE_TYPES,
  updateNoticeProblem,
  updateNoticeText,
} from "../app/lib/publications/update-notice.mjs";

/** The known-retracted DOI. Not one of ours, deliberately. */
const RETRACTED = "10.1016/S0140-6736(97)11096-0";

test("a real retraction produces the sentence, the label and the notice link", () => {
  const notice = { type: "retraction", doi: RETRACTED, date: "2010-02-02" };
  assert.equal(updateNoticeProblem(notice), null);

  const rendered = updateNoticeText(notice);
  assert.equal(rendered.label, "Retracted");
  assert.equal(rendered.sentence, "This paper was retracted on 2010-02-02 by the publisher.");
  assert.equal(rendered.url, `https://doi.org/${RETRACTED}`);
});

test("the date is in the sentence when there is one, and absent when there is not", () => {
  // "Retracted" with no date invites the reader to assume it just happened.
  const undated = updateNoticeText({ type: "retraction", doi: RETRACTED, date: null });
  assert.equal(undated.sentence, "This paper was retracted by the publisher.");
  assert.ok(!undated.sentence.includes("on "));
});

test("a correction and an expression of concern each read as themselves", () => {
  assert.equal(
    updateNoticeText({ type: "correction", doi: RETRACTED, date: "2011-01-01" }).sentence,
    "This paper was corrected on 2011-01-01 by the publisher.",
  );
  const concern = updateNoticeText({
    type: "expression-of-concern",
    doi: RETRACTED,
    date: null,
  });
  // Not "This paper was expression of concern by the publisher", which is what
  // a single sentence template produces for the third kind.
  assert.equal(
    concern.sentence,
    "The publisher has issued an expression of concern about this paper.",
  );
  assert.equal(concern.label, "Expression of concern");
});

test("every declared type renders rather than throwing", () => {
  // A type in the union with no label would throw at render time on the one day
  // it mattered. The union is the scope, so the sweep cannot be empty.
  assert.ok(UPDATE_TYPES.length >= 3);
  for (const type of UPDATE_TYPES) {
    const rendered = updateNoticeText({ type, doi: RETRACTED, date: null });
    assert.ok(rendered.sentence.length > 0, `${type} produced no sentence`);
    assert.ok(rendered.label.length > 0, `${type} produced no label`);
  }
});

test("absence is not a problem, because most records have no notice", () => {
  assert.equal(updateNoticeProblem(null), null);
  assert.equal(updateNoticeProblem(undefined), null);
});

test("a malformed notice is refused, and the reason names the field", () => {
  // The failure this prevents: `https://doi.org/undefined` rendered as the link
  // on the most serious sentence this site can print.
  assert.match(updateNoticeProblem({ type: "retraction", doi: "" }), /doi/);
  assert.match(updateNoticeProblem({ type: "retraction", doi: "not-a-doi" }), /doi/);
  assert.match(
    updateNoticeProblem({ type: "retraction", doi: `https://doi.org/${RETRACTED}` }),
    /doi/,
  );
  assert.match(updateNoticeProblem({ type: "withdrawn", doi: RETRACTED }), /type/);
  assert.match(
    updateNoticeProblem({ type: "retraction", doi: RETRACTED, date: "2010" }),
    /date/,
  );
  assert.match(updateNoticeProblem("retracted"), /not an object/);
});

test("rendering a malformed notice throws rather than half rendering one", () => {
  assert.throws(
    () => updateNoticeText({ type: "retraction", doi: "not-a-doi", date: null }),
    /unusable update notice/,
  );
});

test("no record in the corpus carries a notice today", async () => {
  /*
   * The other half of the fixture, and the one that keeps this test honest: the
   * path above is dark, and if it ever stops being dark this assertion is what
   * says so, in the test file that explains what the path is for.
   * check:publications asserts the same thing with the count of records it read
   * beside it, because a sweep of nothing passes this too.
   */
  const { PUBLICATIONS } = await import("../app/data/publications.ts");
  assert.ok(PUBLICATIONS.length > 0, "empty corpus, so the sweep below is vacuous");
  const noticed = PUBLICATIONS.filter((p) => p.updateNotice).map((p) => p.id);
  assert.deepEqual(noticed, []);
});
