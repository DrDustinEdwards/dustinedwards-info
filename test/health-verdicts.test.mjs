/**
 * The health run's verdicts.
 *
 * REPLAYS THE DEFECT, per hard rule 12. The defect is not a wrong verdict; it
 * is that on 31 July 2026 the Ask index lost nine records, `askIndexStatus`
 * computed that number correctly for 21 days, and no verdict existed to turn it
 * into anything. So the replay is the shape of that day's reading: nine
 * missing, and an assertion that it is reported as a breach and that the number
 * nine survives into the sentence a person reads.
 *
 * The second check is the R2 acceptance trip-wire. Its replay is the future
 * event rather than a past one, because the whole point of it is that the
 * condition it watches for has not happened yet: `MEDIA` measured empty on
 * 2026-08-22, RECOVERY.md section 3 accepted having no backup on that basis,
 * and one uploaded object ends the acceptance.
 *
 * @see app/lib/health/verdicts.mjs
 * @see app/lib/health/checks.server.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  askDriftVerdict,
  contentDriftCompare,
  contentDriftVerdict,
  mediaDriftVerdict,
  ftsEqualityVerdict,
  mediaUnbackedVerdict,
  publicHealthBody,
} from "../app/lib/health/verdicts.mjs";

/** The shape a healthy live database returns. Each test perturbs one field. */
const HEALTHY_FTS = { posts: 12, postsFts: 12, docs: 46, identity: 46, prose: 46 };

test("nine missing records is a breach, and the nine reaches the message", () => {
  const verdict = askDriftVerdict({
    expected: 46,
    present: 37,
    missing: Array.from({ length: 9 }, (_, i) => `missing-key-${i}`),
    stale: [],
  });

  assert.equal(verdict.ok, false, "nine missing records must not read as healthy");
  assert.match(verdict.detail, /drift 9\b/, "the drift count belongs in the sentence");
  assert.match(verdict.detail, /9 missing/);
  assert.match(verdict.detail, /sync-ask/, "a breach must name its repair");
});

test("an index in step is not a breach", () => {
  const verdict = askDriftVerdict({ expected: 46, present: 46, missing: [], stale: [] });
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /46 expected/);
});

test("STALE counts as drift too, in the other direction", () => {
  // A record the corpus no longer knows about is a reader getting a wrong
  // answer just as much as one the index lacks. A verdict that only counted
  // `missing` would pass while Ask cited a deleted post.
  const verdict = askDriftVerdict({ expected: 12, present: 15, missing: [], stale: ["a", "b", "c"] });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /drift 3\b/);
  assert.match(verdict.detail, /3 stale/);
});

test("both directions are summed, not maxed", () => {
  const verdict = askDriftVerdict({ expected: 10, present: 10, missing: ["x"], stale: ["y"] });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /drift 2\b/, "one missing plus one stale is two problems");
});

test("an empty MEDIA bucket keeps the no-backup acceptance alive", () => {
  const verdict = mediaUnbackedVerdict([]);
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /RECOVERY\.md section 3/, "the verdict must cite what it rests on");
});

test("one uploaded original ends the acceptance and names the key", () => {
  const verdict = mediaUnbackedVerdict([{ key: "posts/first-upload.png" }]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /posts\/first-upload\.png/, "name the object, not just the count");
  assert.match(verdict.detail, /not regenerable/);
  assert.match(verdict.detail, /re-decided/);
});

test("agreeing FTS counts are healthy", () => {
  const verdict = ftsEqualityVerdict(HEALTHY_FTS);
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /search_docs=46/);
});

test("a drained posts_fts_docsize is a breach, which is the DELETE FROM shape", () => {
  // The measured defect: after DELETE FROM posts_fts the index count still read
  // 1 of 1 through the content table while the docsize shadow went to 0.
  const verdict = ftsEqualityVerdict({ ...HEALTHY_FTS, postsFts: 0 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /posts=12 but posts_fts_docsize=0/);
  assert.match(verdict.detail, /'rebuild'/, "the breach must carry the repair");
  assert.match(verdict.detail, /Do NOT DELETE FROM/, "and the way to make it worse");
});

test("one half of the three-way going stale is a breach", () => {
  const verdict = ftsEqualityVerdict({ ...HEALTHY_FTS, prose: 37 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /search_prose_docsize=37/);
});

test("both equalities are reported, not just the first", () => {
  const verdict = ftsEqualityVerdict({ posts: 12, postsFts: 9, docs: 46, identity: 46, prose: 40 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /posts_fts_docsize=9/, "the blog index half");
  assert.match(verdict.detail, /search_prose_docsize=40/, "and the search half");
});

test("FAIL CLOSED: a count that could not be read is not a passing check", () => {
  // An empty row is what `.first()` returns when the query matched nothing. A
  // verdict that compared undefined against undefined would report health.
  for (const row of [{}, { ...HEALTHY_FTS, docs: undefined }, { ...HEALTHY_FTS, prose: null }]) {
    const verdict = ftsEqualityVerdict(row);
    assert.equal(verdict.ok, false, `${JSON.stringify(row)} must not read as healthy`);
    assert.match(verdict.detail, /unreadable/);
  }
});

test("FAIL CLOSED: a non-integer count is unreadable, not coerced", () => {
  // A string "46" compares unequal to 46 under ===, so a lenient verdict would
  // report drift; a coercing one would report health. Both are wrong answers to
  // "can this check determine anything".
  const verdict = ftsEqualityVerdict({ ...HEALTHY_FTS, identity: "46" });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /unreadable/);
  assert.match(verdict.detail, /identity/);
});

/* ---------------- the public body, and what it must never carry ---------- */

test("the wire body carries names and booleans only", async () => {
  const { publicHealthBody } = await import("../app/lib/health/verdicts.mjs");

  // Details as they actually look on a failing run: row counts, index sizes and
  // an R2 object key. None of it may reach an unauthenticated endpoint.
  const run = {
    checks: [
      { name: "ask-index-drift", ok: false, detail: "Ask index drift 9: 9 missing, 46 expected" },
      { name: "media-unbacked", ok: false, detail: "first key: posts/private-upload.png" },
      { name: "fts-equality", ok: true, detail: "search_docs=46=identity=prose" },
    ],
  };

  const body = publicHealthBody(run);
  const wire = JSON.stringify(body);

  for (const leak of ["46", "posts/", "private-upload", "search_docs", "drift 9", "missing"]) {
    assert.ok(!wire.includes(leak), `the wire body leaks ${JSON.stringify(leak)}: ${wire}`);
  }

  // And it still says everything the workflow needs.
  assert.equal(body.ok, false);
  assert.deepEqual(
    body.checks.map((c) => c.name),
    ["ask-index-drift", "media-unbacked", "fts-equality"],
    "order is part of the shape the workflow parses",
  );
  assert.deepEqual(
    body.checks.map((c) => c.ok),
    [false, false, true],
  );
});

test("ok is true only when every check passed", async () => {
  const { publicHealthBody } = await import("../app/lib/health/verdicts.mjs");
  const pass = { name: "a", ok: true, detail: "" };
  const fail = { name: "b", ok: false, detail: "" };

  assert.equal(publicHealthBody({ checks: [pass, pass] }).ok, true);
  assert.equal(publicHealthBody({ checks: [pass, fail] }).ok, false);
  assert.equal(publicHealthBody({ checks: [fail] }).ok, false);
});

test("a field added to a check later cannot leak by inheritance", async () => {
  const { publicHealthBody } = await import("../app/lib/health/verdicts.mjs");
  // The body is rebuilt field by field rather than spread, so this stays true
  // when someone adds a field to HealthCheck without thinking about the wire.
  const body = publicHealthBody({
    checks: [{ name: "a", ok: true, detail: "x", secretToken: "SHOULD-NOT-APPEAR" }],
  });
  assert.ok(!JSON.stringify(body).includes("SHOULD-NOT-APPEAR"));
  assert.deepEqual(Object.keys(body.checks[0]), ["name", "ok"]);
});

/* ---------------- the per-check timeout --------------------------------- */

test("a check that answers in time is passed through untouched", async () => {
  const { withTimeout } = await import("../app/lib/health/verdicts.mjs");
  const verdict = await withTimeout(Promise.resolve({ ok: true, detail: "fine" }), 50, "quick");
  assert.deepEqual(verdict, { ok: true, detail: "fine" });
});

test("A HUNG CHECK IS A FAILED CHECK, not a hung response", async () => {
  const { withTimeout } = await import("../app/lib/health/verdicts.mjs");
  // Never settles. Before the timeout this would hang the endpoint, and an
  // endpoint that cannot answer is indistinguishable from the site being down.
  const started = Date.now();
  const verdict = await withTimeout(new Promise(() => {}), 30, "wedged");
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /wedged/);
  assert.match(verdict.detail, /30ms/);
  assert.ok(Date.now() - started < 5000, "the timeout did not actually bound the wait");
});

test("a rejecting check is a failed check carrying its message", async () => {
  const { withTimeout } = await import("../app/lib/health/verdicts.mjs");
  const verdict = await withTimeout(Promise.reject(new Error("D1 unreachable")), 50, "db");
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /D1 unreachable/);
});

test("the timeout clears the day's slowest measured healthy path", async () => {
  const { CHECK_TIMEOUT_MS } = await import("../app/lib/health/verdicts.mjs");
  // ask-index-drift was measured at a 2332ms maximum on production 2026-08-19.
  // A timeout at or under that turns a known-healthy tail into a false alarm.
  assert.ok(
    CHECK_TIMEOUT_MS > 2332,
    `${CHECK_TIMEOUT_MS}ms would fire on the measured healthy maximum of 2332ms`,
  );
});

/* ------------------ the two counts on a failing drift check --------------- */

test("A FAILING drift check carries its two counts, and nothing else new", () => {
  // The 17:15Z flap: ask-index-drift went false and could not be triaged,
  // because the body said which check failed and not how far apart the sides
  // were. One record apart mid-rebuild is not the same event as a hundred.
  const body = publicHealthBody({
    checks: [
      {
        name: "ask-index-drift",
        ok: false,
        detail: "Repair with sync-ask on /admin/posts.",
        counts: { expected: 113, present: 108 },
      },
    ],
  });
  assert.deepEqual(Object.keys(body.checks[0]).sort(), ["expected", "name", "ok", "present"]);
  assert.equal(body.checks[0].expected, 113);
  assert.equal(body.checks[0].present, 108);
});

test("A PASSING check stays exactly as narrow as it was", () => {
  const body = publicHealthBody({
    checks: [
      { name: "fts-equality", ok: true, detail: "counts", counts: { expected: 1, present: 1 } },
    ],
  });
  assert.deepEqual(Object.keys(body.checks[0]).sort(), ["name", "ok"]);
});

test("THE DETAIL STRING NEVER TRAVELS, on either outcome", () => {
  // detail carries an R2 OBJECT KEY on media-unbacked and the shadow table
  // names on fts-equality. That is what the names-and-booleans rule is for.
  const serialised = JSON.stringify(
    publicHealthBody({
      checks: [
        { name: "media-unbacked", ok: false, detail: "og/secret-key.png is unbacked" },
        { name: "fts-equality", ok: true, detail: "search_identity_docsize=113" },
      ],
    }),
  );
  assert.doesNotMatch(serialised, /secret-key/, "an R2 key must not reach the wire");
  assert.doesNotMatch(serialised, /docsize/, "shadow table names must not either");
  assert.doesNotMatch(serialised, /detail/, "the field itself must be absent");
});

test("a failing check with NO counts is still just name and ok", () => {
  // media-unbacked has no two-sided comparison to report, so it opts out by
  // simply not carrying counts rather than by being special-cased.
  const body = publicHealthBody({
    checks: [{ name: "media-unbacked", ok: false, detail: "a key" }],
  });
  assert.deepEqual(Object.keys(body.checks[0]).sort(), ["name", "ok"]);
});

test("askDriftVerdict supplies the counts it fails on", () => {
  const v = askDriftVerdict({ missing: ["a"], stale: [], expected: 113, present: 112 });
  assert.equal(v.ok, false);
  assert.deepEqual(v.counts, { expected: 113, present: 112 });
});

test("a HEALTHY askDriftVerdict carries no counts to leak", () => {
  const v = askDriftVerdict({ missing: [], stale: [], expected: 113, present: 113 });
  assert.equal(v.ok, true);
  assert.equal(v.counts, undefined);
});

/* -------------------------------------------------------------------------
 * media-index-drift. The check that makes the media self-repair possible, and
 * the one whose drift a count comparison can miss entirely.
 * ---------------------------------------------------------------------- */

test("media drift: agreement is ok and says both counts", () => {
  const v = mediaDriftVerdict({ expected: 69, present: 69, missing: [], extra: [] });
  assert.equal(v.ok, true);
  assert.match(v.detail, /69 expected/);
  assert.match(v.detail, /69 present/);
  // A passing check carries no counts onto the wire. publicHealthBody opts them
  // in only for failures, so a green body stays names and booleans.
  assert.equal(v.counts, undefined);
});

test("media drift: THE OFL.txt SHAPE, one file with no row", () => {
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

test("media drift: BOTH DIRECTIONS AT ONCE, which equal totals would hide", () => {
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

test("media drift: a row for a deleted object is drift on its own", () => {
  const v = mediaDriftVerdict({ expected: 68, present: 69, missing: [], extra: ["/gone.png"] });
  assert.equal(v.ok, false);
  assert.match(v.detail, /1 extra/);
});

test("media drift: the detail names a repair a reader can actually run", () => {
  const v = mediaDriftVerdict({ expected: 2, present: 1, missing: ["/a.png"], extra: [] });
  assert.match(v.detail, /sync_media/);
  assert.match(v.detail, /admin\/media/);
});

/* ---- content drift ------------------------------------------------------- */

test("content drift: agreement on every sha is the quiet case", () => {
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

test("content drift: one sha changed, one file unrowed, one row unfiled, all three counted", () => {
  // The fixture the check was built against: every drift direction at once.
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

test("content drift: a NULL source_blob_sha is drift, not agreement", () => {
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

test("content drift: equal totals with one sha changed is still drift", () => {
  const v = contentDriftVerdict(
    [{ slug: "a", sha: "x" }],
    [{ slug: "a", source_blob_sha: "y" }],
  );
  assert.equal(v.ok, false);
  assert.deepEqual(v.counts, { expected: 1, present: 0 });
});
