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
