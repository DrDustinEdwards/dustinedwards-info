import test from "node:test";
import assert from "node:assert/strict";

import {
  askDriftVerdict,
  contentDriftCompare,
  contentDriftVerdict,
  procedureDriftVerdict,
  cvDriftVerdict,
  cvPdfDriftVerdict,
  dictionaryDriftVerdict,
  pageDriftVerdict,
  llmsDriftVerdict,
  rosterDriftVerdict,
  phageDriftVerdict,
  publicationDriftVerdict,
  mediaDriftVerdict,
  ftsEqualityVerdict,
  CHECK_TIMEOUT_MS,
} from "../app/lib/health/verdicts.mjs";

const HEALTHY_FTS = { posts: 12, postsFts: 12, docs: 46, identity: 46, prose: 46 };

await test("an Ask index short of its query is a breach, and the counts reach the message", () => {
  const verdict = askDriftVerdict({ expected: 46, present: 37, failed: 0, indexing: 9 });
  assert.equal(verdict.ok, false, "nine rows not yet indexed must not read as healthy");
  assert.match(verdict.detail, /46 expected, 37 present/);
  assert.match(verdict.detail, /9 indexing/);
});

await test("a refused row is a breach even when the counts agree", () => {
  // AI Search keeps the old item of a row it refuses, so the counts can agree while the index holds stale text.
  const verdict = askDriftVerdict({ expected: 46, present: 46, failed: 1, indexing: 0 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /1 refused/);
});

await test("an index in step is not a breach", () => {
  const verdict = askDriftVerdict({ expected: 46, present: 46, failed: 0, indexing: 0 });
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /46 expected/);
});

await test("agreeing FTS counts are healthy", () => {
  const verdict = ftsEqualityVerdict(HEALTHY_FTS);
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /search_docs=46/);
});

await test("a drained posts_fts_docsize is a breach, which is the DELETE FROM shape", () => {
  // After DELETE FROM posts_fts the index count still reads 1 of 1 through the content table
  // while the docsize shadow goes to 0.
  const verdict = ftsEqualityVerdict({ ...HEALTHY_FTS, postsFts: 0 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /posts=12 but posts_fts_docsize=0/);
  assert.match(verdict.detail, /'rebuild'/, "the breach must carry the repair");
  assert.match(verdict.detail, /Do NOT DELETE FROM/, "and the way to make it worse");
});

await test("one half of the three-way going stale is a breach", () => {
  const verdict = ftsEqualityVerdict({ ...HEALTHY_FTS, prose: 37 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /search_prose_docsize=37/);
});

await test("both equalities are reported, not just the first", () => {
  const verdict = ftsEqualityVerdict({ posts: 12, postsFts: 9, docs: 46, identity: 46, prose: 40 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /posts_fts_docsize=9/, "the blog index half");
  assert.match(verdict.detail, /search_prose_docsize=40/, "and the search half");
});

await test("FAIL CLOSED: a count that could not be read is not a passing check", () => {
  // An empty row is what `.first()` returns when the query matched nothing. A
  // verdict that compared undefined against undefined would report health.
  for (const row of [{}, { ...HEALTHY_FTS, docs: undefined }, { ...HEALTHY_FTS, prose: null }]) {
    const verdict = ftsEqualityVerdict(row);
    assert.equal(verdict.ok, false, `${JSON.stringify(row)} must not read as healthy`);
    assert.match(verdict.detail, /unreadable/);
  }
});

await test("FAIL CLOSED: a non-integer count is unreadable, not coerced", () => {
  // A string "46" is unequal to 46 under ===, so a lenient verdict reports drift and a
  // coercing one reports health; both are wrong answers to "can this check determine anything".
  const verdict = ftsEqualityVerdict({ ...HEALTHY_FTS, identity: "46" });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /unreadable/);
  assert.match(verdict.detail, /identity/);
});

await test("the timeout clears the day's slowest measured healthy path", () => {
  // ask-index-drift was measured at a 2332ms maximum on production 2026-08-19.
  // A timeout at or under that turns a known-healthy tail into a false alarm.
  assert.ok(
    CHECK_TIMEOUT_MS > 2332,
    `${CHECK_TIMEOUT_MS}ms would fire on the measured healthy maximum of 2332ms`,
  );
});

await test("askDriftVerdict supplies the counts it fails on", () => {
  const v = askDriftVerdict({ expected: 113, present: 112, failed: 0, indexing: 1 });
  assert.equal(v.ok, false);
  assert.deepEqual(v.counts, { expected: 113, present: 112 });
});

await test("a HEALTHY askDriftVerdict carries no counts to leak", () => {
  const v = askDriftVerdict({ expected: 113, present: 113, failed: 0, indexing: 0 });
  assert.equal(v.ok, true);
  assert.equal(v.counts, undefined);
});

await test("media drift: agreement is ok and says both counts", () => {
  const v = mediaDriftVerdict({ expected: 69, present: 69, missing: [], extra: [] });
  assert.equal(v.ok, true);
  assert.match(v.detail, /69 expected/);
  assert.match(v.detail, /69 present/);
  assert.equal(v.counts, undefined);
});

await test("media drift: THE OFL.txt SHAPE, one file with no row", () => {
  const v = mediaDriftVerdict({
    expected: 69,
    present: 68,
    missing: ["/fonts/OFL.txt"],
    extra: [],
  });
  assert.equal(v.ok, false);
  assert.match(v.detail, /drift 1/);
  assert.match(v.detail, /1 missing/);
  assert.deepEqual(v.counts, { expected: 69, present: 68 });
});

await test("media drift: BOTH DIRECTIONS AT ONCE, which equal totals would hide", () => {
  // One asset unindexed and one row for something deleted. The totals agree;
  // the index is wrong twice. Summing the key sets is what sees it.
  const v = mediaDriftVerdict({
    expected: 69,
    present: 69,
    missing: ["/fonts/OFL.txt"],
    extra: ["/gone.png"],
  });
  assert.equal(v.ok, false);
  assert.match(v.detail, /drift 2/);
  assert.deepEqual(v.counts, { expected: 69, present: 69 });
});

await test("media drift: a row for a deleted object is drift on its own", () => {
  const v = mediaDriftVerdict({ expected: 68, present: 69, missing: [], extra: ["/gone.png"] });
  assert.equal(v.ok, false);
  assert.match(v.detail, /1 extra/);
});

await test("media drift: the detail names a repair a reader can actually run", () => {
  const v = mediaDriftVerdict({ expected: 2, present: 1, missing: ["/a.png"], extra: [] });
  assert.match(v.detail, /sync_media/);
  assert.match(v.detail, /admin\/tools/);
});

await test("content drift: agreement on every sha is the quiet case", () => {
  const files = [
    { slug: "a", sha: "s1" },
    { slug: "b", sha: "s2" },
  ];
  const rows = [
    { slug: "a", source_blob_sha: "s1" },
    { slug: "b", source_blob_sha: "s2" },
  ];
  const v = contentDriftVerdict(files, rows);
  assert.equal(v.ok, true);
  assert.match(v.detail, /2 post file/);
  assert.equal(v.counts, undefined, "a passing check carries no counts");
});

await test("content drift: one sha changed, one file unrowed, one row unfiled, all three counted", () => {
  const files = [
    { slug: "changed", sha: "new-sha" },
    { slug: "agreeing", sha: "same" },
    { slug: "unrowed", sha: "fresh" },
  ];
  const rows = [
    { slug: "changed", source_blob_sha: "old-sha" },
    { slug: "agreeing", source_blob_sha: "same" },
    { slug: "unfiled", source_blob_sha: "orphan" },
  ];
  const compared = contentDriftCompare(files, rows);
  assert.deepEqual(compared, {
    changed: ["changed"],
    unrowed: ["unrowed"],
    unfiled: ["unfiled"],
  });
  const v = contentDriftVerdict(files, rows);
  assert.equal(v.ok, false);
  assert.match(v.detail, /1 sha-changed/, "the detail names the changed count");
  assert.match(v.detail, /1 file\(s\) with no row/, "the detail names the unrowed count");
  assert.match(v.detail, /1 row\(s\) with no file/, "the detail names the unfiled count");
  assert.match(v.detail, /sync_posts/, "the detail names a repair a reader can run");
  // 3 files, one changed and one unrowed: only 1 is in full agreement.
  assert.deepEqual(v.counts, { expected: 3, present: 1 });
});

await test("content drift: a NULL source_blob_sha is drift, not agreement", () => {
  // A row written before migration 0013 carries NULL; the repository file has
  // a sha. Treating NULL as a match would hide every pre-migration row
  // forever, which is the substituting-fallback shape.
  const v = contentDriftVerdict(
    [{ slug: "old", sha: "s1" }],
    [{ slug: "old", source_blob_sha: null }],
  );
  assert.equal(v.ok, false);
  assert.match(v.detail, /1 sha-changed/);
});

await test("content drift: equal totals with one sha changed is still drift", () => {
  const v = contentDriftVerdict([{ slug: "a", sha: "x" }], [{ slug: "a", source_blob_sha: "y" }]);
  assert.equal(v.ok, false);
  assert.deepEqual(v.counts, { expected: 1, present: 0 });
});

await test("procedure drift: the same comparison, naming procedures and sync_procedures", () => {
  const files = [
    { slug: "edited", sha: "new" },
    { slug: "agreeing", sha: "same" },
    { slug: "added", sha: "fresh" },
  ];
  const rows = [
    { slug: "edited", source_blob_sha: "old" },
    { slug: "agreeing", source_blob_sha: "same" },
    { slug: "deleted", source_blob_sha: "orphan" },
  ];
  const v = procedureDriftVerdict(files, rows);
  assert.equal(v.ok, false);
  assert.match(v.detail, /^Procedure drift 3:/);
  assert.match(v.detail, /1 sha-changed/);
  assert.match(v.detail, /1 file\(s\) with no row/);
  assert.match(v.detail, /1 row\(s\) with no file/);
  assert.match(v.detail, /3 procedure file\(s\)/);
  assert.match(v.detail, /sync_procedures/);
  assert.doesNotMatch(v.detail, /sync_posts/);
  assert.deepEqual(v.counts, { expected: 3, present: 1 });

  const quiet = procedureDriftVerdict(
    [{ slug: "a", sha: "s" }],
    [{ slug: "a", source_blob_sha: "s" }],
  );
  assert.equal(quiet.ok, true);
  assert.match(quiet.detail, /1 procedure file/);
});

await test("dictionary drift: the same comparison, naming dictionary entries and sync_dictionary", () => {
  const drifted = dictionaryDriftVerdict(
    [{ slug: "capsid", sha: "new" }],
    [{ slug: "capsid", source_blob_sha: "old" }],
  );
  assert.equal(drifted.ok, false);
  assert.match(drifted.detail, /^Dictionary drift 1:/);
  assert.match(drifted.detail, /1 dictionary entry file\(s\)/);
  assert.match(drifted.detail, /sync_dictionary/);
  assert.deepEqual(drifted.counts, { expected: 1, present: 0 });
  assert.equal(
    dictionaryDriftVerdict([{ slug: "a", sha: "s" }], [{ slug: "a", source_blob_sha: "s" }]).ok,
    true,
  );
});

await test("page and publication drift: the same comparison, each naming its own noun and repair", () => {
  const files = [
    { slug: "research-phages", sha: "new" },
    { slug: "teaching-labs", sha: "same" },
  ];
  const rows = [
    { slug: "research-phages", source_blob_sha: "old" },
    { slug: "teaching-labs", source_blob_sha: "same" },
    { slug: "removed-page", source_blob_sha: "orphan" },
  ];
  const page = pageDriftVerdict(files, rows);
  assert.equal(page.ok, false);
  assert.match(page.detail, /^Page drift 2:/);
  assert.match(page.detail, /2 page file\(s\)/);
  assert.match(page.detail, /sync_pages/);
  assert.deepEqual(page.counts, { expected: 2, present: 1 });

  const paper = publicationDriftVerdict(files, rows);
  assert.equal(paper.ok, false);
  assert.match(paper.detail, /^Publication drift 2:/);
  assert.match(paper.detail, /2 publication file\(s\)/);
  assert.match(paper.detail, /sync_publications/);
  assert.doesNotMatch(paper.detail, /sync_pages|sync_posts/);

  const agreeing = [{ slug: "a", sha: "s" }];
  const matching = [{ slug: "a", source_blob_sha: "s" }];
  assert.equal(pageDriftVerdict(agreeing, matching).ok, true);
  assert.equal(publicationDriftVerdict(agreeing, matching).ok, true);

  const cv = cvDriftVerdict(files, rows);
  assert.equal(cv.ok, false);
  assert.match(cv.detail, /^CV drift 2:/);
  assert.match(cv.detail, /2 CV file\(s\)/);
  assert.match(cv.detail, /sync_cv/);
  assert.doesNotMatch(cv.detail, /sync_pages|sync_posts|sync_publications/);
  assert.equal(cvDriftVerdict(agreeing, matching).ok, true);
});

await test("llms.txt drift: one file against one row, naming its own repair", () => {
  const stale = llmsDriftVerdict(
    [{ slug: "llms", sha: "new" }],
    [{ slug: "llms", source_blob_sha: "old" }],
  );
  assert.equal(stale.ok, false);
  assert.match(stale.detail, /^llms.txt drift 1: 1 sha-changed/);
  assert.match(stale.detail, /sync_llms/);
  assert.deepEqual(stale.counts, { expected: 1, present: 0 });

  const unrowed = llmsDriftVerdict([{ slug: "llms", sha: "s" }], []);
  assert.equal(
    unrowed.ok,
    false,
    "no row means /llms.txt serves the bundled copy, which may be older",
  );

  assert.equal(
    llmsDriftVerdict([{ slug: "llms", sha: "s" }], [{ slug: "llms", source_blob_sha: "s" }]).ok,
    true,
  );
});

await test("roster drift: the same comparison, naming cohorts and sync_roster", () => {
  const files = [
    { slug: "2031", sha: "new" },
    { slug: "2030", sha: "same" },
  ];
  const rows = [
    { slug: "2031", source_blob_sha: "old" },
    { slug: "2030", source_blob_sha: "same" },
    { slug: "2029", source_blob_sha: "orphan" },
  ];
  const verdict = rosterDriftVerdict(files, rows);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /^Roster drift 2:/);
  assert.match(verdict.detail, /2 cohort file\(s\)/);
  assert.match(verdict.detail, /sync_roster/);
  assert.doesNotMatch(verdict.detail, /sync_pages|sync_posts/);
  assert.deepEqual(verdict.counts, { expected: 2, present: 1 });

  assert.equal(
    rosterDriftVerdict([{ slug: "2031", sha: "s" }], [{ slug: "2031", source_blob_sha: "s" }]).ok,
    true,
  );
});

await test("phage drift: the same comparison, naming phages and sync_phages", () => {
  const files = [
    { slug: "zeta", sha: "new" },
    { slug: "acorn15", sha: "same" },
  ];
  const rows = [
    { slug: "zeta", source_blob_sha: "old" },
    { slug: "acorn15", source_blob_sha: "same" },
    { slug: "gone", source_blob_sha: "orphan" },
  ];
  const verdict = phageDriftVerdict(files, rows);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /^Phage drift 2:/);
  assert.match(verdict.detail, /2 phage file\(s\)/);
  assert.match(verdict.detail, /sync_phages/);
  assert.doesNotMatch(verdict.detail, /sync_pages|sync_posts/);
  assert.deepEqual(verdict.counts, { expected: 2, present: 1 });

  assert.equal(
    phageDriftVerdict([{ slug: "zeta", sha: "s" }], [{ slug: "zeta", source_blob_sha: "s" }]).ok,
    true,
  );
});

await test("CV PDF drift: the stored fingerprint against the data's, naming sync_cv_pdf", () => {
  assert.equal(cvPdfDriftVerdict({ stored: "ab12cd34", expected: "ab12cd34" }).ok, true);

  const stale = cvPdfDriftVerdict({ stored: "00000000", expected: "ab12cd34" });
  assert.equal(stale.ok, false);
  assert.match(stale.detail, /^CV PDF drift 1:/);
  assert.match(stale.detail, /drawn from 00000000/);
  assert.match(stale.detail, /sync_cv_pdf/);
  assert.deepEqual(stale.counts, { expected: 1, present: 0 });

  const missing = cvPdfDriftVerdict({ stored: null, expected: "ab12cd34" });
  assert.equal(missing.ok, false, "no object means /dustin-edwards-cv.pdf answers 404");
  assert.match(missing.detail, /no stored CV PDF/);

  const unstamped = cvPdfDriftVerdict({ stored: "", expected: "ab12cd34" });
  assert.equal(unstamped.ok, false, "an object with no fingerprint cannot be shown current");
  assert.match(unstamped.detail, /no fingerprint/);
});
