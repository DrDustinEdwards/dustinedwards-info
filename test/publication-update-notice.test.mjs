/* Nothing in this corpus is retracted, so the fixture is a thoroughly documented retraction from
 * outside it, which cannot quietly become wrong or read as a claim about one of ours. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  UPDATE_TYPES,
  updateNoticeProblem,
  updateNoticeText,
} from "../app/lib/publications/update-notice.mjs";

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
  // Otherwise `https://doi.org/undefined` would render as the link on the most serious
  // sentence this site can print.
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
