/**
 * The health run's DECISIONS, separated from its bindings.
 *
 * `workers/health.ts` does the I/O: it reads the Ask index, lists the bucket,
 * posts the webhook. Everything that decides whether a reading is a breach, and
 * what a person is told about it, is here, because this half is the half that
 * can be wrong in a way nothing notices.
 *
 * The split is not tidiness. `check:tests` is the one gate in this repo that
 * asserts BEHAVIOUR, it runs `node --test` over pure modules, and a verdict
 * living inside a Worker handler that imports `~/lib/search/ask.server` cannot
 * be reached by it at all. So the rule that produced this file is: if it can be
 * wrong, it must be testable, and in this repo testable means `.mjs` with no
 * binding in sight.
 *
 * @see workers/health.ts
 * @see test/health-verdicts.test.mjs
 */

/**
 * Is the Ask index in step with D1?
 *
 * **THE DRIFT IS BOTH DIRECTIONS SUMMED, and that is deliberate.** `missing` is
 * a record the index lacks and `stale` is one the corpus no longer knows about;
 * either is a reader getting a wrong answer, so either is a breach. This
 * matches what the admin badge already counts, so the alert and the badge can
 * never disagree about whether there is a problem.
 *
 * @param {{ expected: number, present: number, missing: string[], stale: string[] }} status
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function askDriftVerdict(status) {
  const drift = status.missing.length + status.stale.length;
  if (drift === 0) {
    return {
      ok: true,
      detail: `Ask index agrees with D1: ${status.expected} expected, ${status.present} present.`,
    };
  }
  return {
    ok: false,
    detail:
      `Ask index drift ${drift}: ${status.missing.length} missing, ` +
      `${status.stale.length} stale, ${status.expected} expected, ` +
      `${status.present} present. Repair with sync-ask on /admin/posts.`,
    // THE TWO COUNTS TRAVEL. Grounds are on publicHealthBody.
    counts: { expected: status.expected, present: status.present },
  };
}

/**
 * Does the media index still describe the assets that actually exist?
 *
 * The sibling of `askDriftVerdict`, added 2026-08-24 when the media index
 * gained a sync at ship. Until then nothing between commits watched this store:
 * `check:media --remote` is a GATE, so it sees drift only when somebody runs
 * it, and the one instance it did find (`/fonts/OFL.txt`, a public file with no
 * row) sat red for weeks because the repair was a click.
 *
 * DRIFT IS THE SUM OF BOTH DIRECTIONS, for the same reason as the answer index
 * and with a sharper edge here: an asset with no row is a file the library
 * cannot describe, a row with no asset is the library offering something that
 * is gone, and the two can cancel in a count comparison while both are true.
 * `mediaIndexStatus` compares KEY SETS, so this adds their sizes rather than
 * subtracting totals.
 *
 * NOT the same question as `media-unbacked` below, which asks whether the MEDIA
 * bucket is still empty. That one guards a recovery acceptance; this one guards
 * a projection. They fail independently.
 *
 * @param {{ expected: number, present: number, missing: string[], extra: string[] }} status
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function mediaDriftVerdict(status) {
  const drift = status.missing.length + status.extra.length;
  if (drift === 0) {
    return {
      ok: true,
      detail: `Media index agrees with R2 and public/: ${status.expected} expected, ${status.present} present.`,
    };
  }
  return {
    ok: false,
    detail:
      `Media index drift ${drift}: ${status.missing.length} missing, ` +
      `${status.extra.length} extra, ${status.expected} expected, ` +
      `${status.present} present. Repair with sync_media on the operator API, ` +
      `or the rebuild action on /admin/media.`,
    // THE TWO COUNTS TRAVEL. Grounds are on publicHealthBody.
    counts: { expected: status.expected, present: status.present },
  };
}

/**
 * Does RECOVERY.md section 3's no-backup acceptance still hold?
 *
 * It rests entirely on the `MEDIA` bucket being empty, measured 2026-08-22: an
 * empty bucket means the unrecoverable set is zero bytes, and an acceptance
 * over zero bytes costs nothing. One uploaded original makes that false, and
 * nothing else on this site announces it, because `check:media` reconciles what
 * IS there and is perfectly happy for there to be more of it.
 *
 * Takes the objects rather than a count so the message can name a key. The
 * caller lists with `limit: 1`; the question is "any", not "how many".
 *
 * @param {Array<{ key: string }>} objects
 * @returns {{ ok: boolean, detail: string }}
 */
export function mediaUnbackedVerdict(objects) {
  if (objects.length === 0) {
    return {
      ok: true,
      detail:
        "MEDIA bucket is empty, so RECOVERY.md section 3's no-backup acceptance still holds.",
    };
  }
  return {
    ok: false,
    detail:
      `MEDIA bucket is NO LONGER EMPTY (first key: ${objects[0]?.key ?? "unknown"}). ` +
      `Uploaded originals are not regenerable and there is no backup. ` +
      `RECOVERY.md section 3 must be re-decided.`,
  };
}

/**
 * The three ways a D1 row and a repository file can part company.
 *
 * Pure and shared: the health check derives its verdict from this, and the
 * `sync_posts` repair derives its work list from the SAME comparison, so what
 * the check calls drift and what the repair repairs cannot disagree.
 *
 *   changed  a slug present on both sides whose blob sha differs: the file
 *            moved and the row has not followed (or a row's provenance was
 *            corrupted, which repairs identically).
 *   unrowed  a file with no row: a post committed from a clone that no sync
 *            has landed yet, or a lost row.
 *   unfiled  a row with no file: a post deleted from the repository whose
 *            rows outlived it.
 *
 * @param {Array<{ slug: string, sha: string }>} files from the Contents
 *   directory listing, blob sha per markdown file
 * @param {Array<{ slug: string, source_blob_sha: string | null }>} rows
 * @returns {{ changed: string[], unrowed: string[], unfiled: string[] }}
 */
export function contentDriftCompare(files, rows) {
  const rowBySlug = new Map(rows.map((r) => [r.slug, r]));
  const fileSlugs = new Set(files.map((f) => f.slug));

  const changed = files
    .filter((f) => {
      const row = rowBySlug.get(f.slug);
      return row !== undefined && row.source_blob_sha !== f.sha;
    })
    .map((f) => f.slug)
    .sort();
  const unrowed = files
    .filter((f) => !rowBySlug.has(f.slug))
    .map((f) => f.slug)
    .sort();
  const unfiled = rows
    .filter((r) => !fileSlugs.has(r.slug))
    .map((r) => r.slug)
    .sort();

  return { changed, unrowed, unfiled };
}

/**
 * Does D1 still hold what the repository says?
 *
 * The check half of the arrangement that let the committed corpus artifact
 * leave the repository: git holds markdown, D1 holds the only rendered copy,
 * and THIS is what watches the two converge. A markdown commit from any
 * machine goes live within one health poll with no deploy, BY DESIGN: the
 * scheduled workflow sees the sha mismatch and repairs it through the
 * operator door (`sync_posts`), which fetches the raw file and re-renders it
 * through the one door to a rendered row.
 *
 * `expected` is the repository's file count and `present` is the count of
 * rows in full agreement, so the public body's two counts say how much of
 * the corpus is in step, not merely how big each side is: equal totals with
 * one sha changed is still drift.
 *
 * @param {Array<{ slug: string, sha: string }>} files
 * @param {Array<{ slug: string, source_blob_sha: string | null }>} rows
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function contentDriftVerdict(files, rows) {
  const { changed, unrowed, unfiled } = contentDriftCompare(files, rows);
  const drift = changed.length + unrowed.length + unfiled.length;
  if (drift === 0) {
    return {
      ok: true,
      detail: `D1 agrees with the repository: ${files.length} post file(s), every blob sha matched by its row.`,
    };
  }
  return {
    ok: false,
    detail:
      `Content drift ${drift}: ${changed.length} sha-changed, ${unrowed.length} ` +
      `file(s) with no row, ${unfiled.length} row(s) with no file, against ` +
      `${files.length} post file(s). Repair with sync_posts on the operator API.`,
    // THE TWO COUNTS TRAVEL. Grounds are on publicHealthBody.
    counts: { expected: files.length, present: files.length - changed.length - unrowed.length },
  };
}

/**
 * Do the FTS indexes still agree with the table they are built from?
 *
 * ## COUNTED ON THE `_docsize` SHADOWS, NEVER ON THE INDEX
 *
 * This is the one trap that makes the whole check worth having. `posts_fts`,
 * `search_identity` and `search_prose` are external-content fts5 tables, so
 * `COUNT(*)` on any of them reads THROUGH to its content table and equals the
 * content table's count no matter how broken the index is. Measured in this
 * repo: after `DELETE FROM posts_fts` the count still read 1 of 1 while MATCH
 * returned nothing, and `posts_fts_docsize` went to 0. The shadow holds one row
 * per INDEXED document, so it is the only number here that can actually fail.
 * `check:invariants` section 7 forbids the wrong form in source, both
 * directions.
 *
 * ## FAIL CLOSED ON A COUNT IT CANNOT READ
 *
 * A missing or non-numeric count is a FAILING check, not a skipped one. The
 * query returning no row, or a column renamed out from under this, would
 * otherwise compare `undefined === undefined` and pass, which is the shape of
 * every gate defect this repo has recorded: a check that examined nothing and
 * reported what a clean run reports.
 *
 * ## TWO INDEPENDENT EQUALITIES
 *
 * `posts` against `posts_fts_docsize` is the blog index. `search_docs` against
 * `search_identity_docsize` and `search_prose_docsize` is the three-way the
 * ship asserts after every sync. They are rebuilt by different statements and
 * fail separately, so both are reported rather than collapsed into one boolean.
 *
 * @param {Record<string, unknown>} counts
 * @returns {{ ok: boolean, detail: string, counts?: { expected: number, present: number } }}
 */
export function ftsEqualityVerdict(counts) {
  const NAMES = ["posts", "postsFts", "docs", "identity", "prose"];

  const unreadable = NAMES.filter((n) => !Number.isInteger(counts[n]) || Number(counts[n]) < 0);
  if (unreadable.length > 0) {
    return {
      ok: false,
      detail:
        `FTS counts unreadable: ${unreadable.join(", ")} ` +
        `${unreadable.length === 1 ? "is" : "are"} missing or not a whole number. ` +
        `A count that cannot be read is not a passing check.`,
    };
  }

  const posts = Number(counts.posts);
  const postsFts = Number(counts.postsFts);
  const docs = Number(counts.docs);
  const identity = Number(counts.identity);
  const prose = Number(counts.prose);

  const broken = [];
  if (posts !== postsFts) broken.push(`posts=${posts} but posts_fts_docsize=${postsFts}`);
  if (identity !== docs || prose !== docs) {
    broken.push(
      `search_docs=${docs} but search_identity_docsize=${identity} and ` +
        `search_prose_docsize=${prose}`,
    );
  }

  if (broken.length === 0) {
    return {
      ok: true,
      detail:
        `FTS indexes agree: posts=${posts}=posts_fts_docsize, ` +
        `search_docs=${docs}=identity=prose.`,
    };
  }

  return {
    ok: false,
    detail:
      `FTS index drift: ${broken.join("; ")}. ` +
      `Rebuild with INSERT INTO <index>(<index>) VALUES('rebuild'). ` +
      `Do NOT DELETE FROM either index; that corrupts it further.`,
    /*
     * THE FIRST DISAGREEING PAIR, not all five counts. `expected` is the
     * content table's row count and `present` is what its shadow reports,
     * which is the pair an operator acts on. The full five are in `detail`,
     * which stays off the wire.
     */
    counts:
      posts !== postsFts
        ? { expected: posts, present: postsFts }
        : { expected: docs, present: identity !== docs ? identity : prose },
  };
}

/**
 * How long any one check may take before it is called failed.
 *
 * Three seconds. The slowest check is `ask-index-drift`, which pages the AI
 * Search index and was measured on production 2026-08-19 at a 208ms median and
 * a 2332ms MAXIMUM across 12 samples. Three seconds clears that measured
 * maximum with room and still bounds the endpoint at roughly nine seconds
 * worst case for three checks, which is inside any sane HTTP client's patience.
 *
 * Tighter would convert the known 2.3-second tail into a false alarm, and a
 * monitor that cries wolf on its own slowest healthy path is a monitor people
 * learn to ignore.
 */
export const CHECK_TIMEOUT_MS = 3000;

/**
 * Races a check against the clock and reports a TIMEOUT AS A FAILURE.
 *
 * ## Why a timeout is a failed check and not a skipped one
 *
 * One hung binding must not hang the response, because the endpoint that
 * cannot answer is indistinguishable to the watcher from the site being down,
 * and the watcher would be right either way. A check that cannot determine an
 * answer is not a passing check.
 *
 * ## WHAT THIS DOES NOT DO, and it matters
 *
 * **It does not cancel the underlying work.** There is no cancellation in a
 * bare promise, so the slow D1 query or R2 listing continues and its result is
 * discarded. What is bounded here is the RESPONSE, not the work. Saying so
 * matters because someone reading "timeout" will otherwise assume the binding
 * was released, and under sustained timeouts the abandoned work is still
 * accumulating behind this.
 *
 * @param {Promise<{ ok: boolean, detail: string, counts?: { expected: number, present: number } }>} promise
 * @param {number} ms
 * @param {string} name
 * @returns {Promise<{ ok: boolean, detail: string, counts?: { expected: number, present: number } }>}
 */
export function withTimeout(promise, ms, name) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () =>
        resolve({
          ok: false,
          detail: `check ${name} did not answer within ${ms}ms and is reported failed`,
        }),
      ms,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          detail: `check threw: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    );
  });
}

/**
 * The PUBLIC body of `/api/health`. Names and booleans, nothing else.
 *
 * ## THE DETAIL STRINGS ARE DELIBERATELY DROPPED
 *
 * Every `detail` on a failing check is useful and none of it belongs on an
 * unauthenticated endpoint. `ask-index-drift` carries how many records the
 * corpus holds and how many the index has; `fts-equality` carries five row
 * counts and the names of the shadow tables; `media-unbacked` carries an R2
 * OBJECT KEY, which is a path into the bucket.
 *
 * None of that is catastrophic and none of it is anyone's business, and the
 * endpoint is polled by a workflow that needs to know WHICH check failed, not
 * why. The why is in Workers Logs, behind the dashboard, where the operator
 * already is when they go looking. So the wire carries the minimum that makes
 * the alert actionable.
 *
 * Shape is stable and the workflow parses it: `ok`, and `checks` as an array of
 * `{ name, ok }` in a fixed order. An object keyed by name was the alternative
 * and was rejected because it makes "list the failing names" a key iteration in
 * ## THE TWO COUNTS ON A FAILING DRIFT CHECK DO TRAVEL, since 2026-08-23
 *
 * A health flap at 17:15Z reported `ask-index-drift` false, recovered by
 * itself, and COULD NOT BE DIAGNOSED: the body said which check failed and
 * nothing about how far apart the two sides were. One record apart mid-sync
 * and a hundred apart are the same alert, and only one of them is an
 * incident.
 *
 * So a FAILING check carries `expected` and `present`, and nothing else
 * changes. Two integers are not secrets: the corpus size is already public
 * (every post is on /blog, and llms.txt counts them), and the index size is
 * the same number when healthy. The strings still do not travel, because
 * those carry an R2 object key and the shadow table names.
 *
 * A PASSING check carries name and ok only, so the quiet case stays exactly
 * as narrow as it was.
 *
 * @param {{ checks: Array<{ name: string, ok: boolean, counts?: { expected: number, present: number } }> }} run
 * @returns {{ ok: boolean, checks: Array<{ name: string, ok: boolean, expected?: number, present?: number }> }}
 */
export function publicHealthBody(run) {
  return {
    ok: run.checks.every((c) => c.ok),
    checks: run.checks.map((c) => {
      // Rebuilt field by field rather than spread, so a field added to
      // HealthCheck later cannot leak onto the wire by inheritance. The two
      // counts are opted IN by name, one at a time, for the same reason.
      if (c.ok || !c.counts) return { name: c.name, ok: c.ok };
      return {
        name: c.name,
        ok: c.ok,
        expected: c.counts.expected,
        present: c.counts.present,
      };
    }),
  };
}

