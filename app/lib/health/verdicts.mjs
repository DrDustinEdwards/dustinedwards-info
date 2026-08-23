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
