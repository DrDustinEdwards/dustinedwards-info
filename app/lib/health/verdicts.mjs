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

/** KV key holding the last completed run, so its AGE is readable in-app. */
export const HEARTBEAT_KEY = "health:last-run";

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
 * @returns {{ ok: boolean, detail: string }}
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
      `MEDIA bucket is NO LONGER EMPTY (first key: ${objects[0].key}). ` +
      `Uploaded originals are not regenerable and there is no backup. ` +
      `RECOVERY.md section 3 must be re-decided.`,
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
 * @returns {{ ok: boolean, detail: string }}
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
 * @param {Promise<{ ok: boolean, detail: string }>} promise
 * @param {number} ms
 * @param {string} name
 * @returns {Promise<{ ok: boolean, detail: string }>}
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
 * jq rather than a filter, and because an array preserves order.
 *
 * @param {{ checks: Array<{ name: string, ok: boolean }> }} run
 * @returns {{ ok: boolean, checks: Array<{ name: string, ok: boolean }> }}
 */
export function publicHealthBody(run) {
  return {
    ok: run.checks.every((c) => c.ok),
    // Rebuilt field by field rather than spread, so a field added to
    // HealthCheck later cannot leak onto the wire by inheritance.
    checks: run.checks.map((c) => ({ name: c.name, ok: c.ok })),
  };
}

/**
 * What a breach looks like when it arrives.
 *
 * ONE SELF-CONTAINED STRING, because most destinations that accept a JSON POST
 * render a single field and drop the rest of the envelope. A payload whose
 * meaning is spread across sibling keys arrives as the word "2".
 *
 * @param {Array<{ name: string, detail: string }>} failed
 * @returns {string}
 */
export function alertText(failed) {
  return (
    `dustinedwards.info health check FAILED (${failed.length}):\n` +
    failed.map((c) => `- ${c.name}: ${c.detail}`).join("\n")
  );
}
