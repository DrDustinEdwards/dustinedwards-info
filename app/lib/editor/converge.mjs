/**
 * Converging D1 onto the repo after a commit has landed, and recording it when
 * that fails.
 *
 * ## THE RULING THIS ENCODES
 *
 * **The repo is the source of truth and D1 is a derived index.** So there is no
 * compensating transaction here and there must never be one: reverting the
 * GitHub write to "fix" a D1 failure would destroy the authoritative copy to
 * tidy up the derived one, which is the wrong direction and is irreversible in
 * the direction that matters. A committed post with a stale index is a site
 * that serves slightly old data. A reverted commit is lost writing.
 *
 * ## WHAT THE AUDIT SAID
 *
 * 2026-08-22, in the database section: "`savePost` writes GitHub first, then
 * D1, with no compensation. A GitHub success followed by a D1 failure leaves
 * the repo ahead of the database with no record." Verified true against the
 * code. The half worth fixing is **"with no record"**, not the ordering: the
 * ordering is correct and deliberate.
 *
 * ## PURE ON PURPOSE
 *
 * Every dependency is injected, so `check:tests` can drive both failure points
 * without a binding: a writer that fails once proves the retry converges, and
 * one that fails twice proves the divergence is recorded and the error names
 * the post. A version of this living inside `publish.server.ts` could only be
 * tested by breaking a real D1.
 *
 * @see app/lib/editor/publish.server.ts
 * @see test/converge.test.mjs
 */

/**
 * The `name` on the thrown error. A STABLE STRING, not a class, because the
 * thrower is `.mjs` and the branch that maps it to an HTTP status is `.ts`; a
 * cross-module `instanceof` through two build graphs is exactly the kind of
 * identity check that works until a bundler duplicates the module.
 */
export const DIVERGENCE_ERROR_NAME = "D1DivergenceError";

/**
 * What the operator is told when the index could not be caught up.
 *
 * THREE FACTS, and each is here because without it the message is unactionable:
 * WHICH post (there may be many and only one diverged), WHICH commit landed
 * (so the writing can be confirmed safe in git without trusting this message),
 * and HOW TO REPAIR IT. The last one matters most: the natural reaction to a
 * failed save is to save again, and saving again is the one thing that does not
 * help, because the commit already landed and the second save would be a no-op
 * against an unchanged file.
 *
 * @param {{ slug: string, commitSha: string, attempts: number, cause?: unknown }} facts
 * @returns {string}
 */
export function divergenceMessage({ slug, commitSha, attempts, cause }) {
  const reason = cause instanceof Error ? cause.message : String(cause ?? "unknown");
  return (
    `The post "${slug}" WAS committed as ${commitSha}, and the database index ` +
    `could not be updated after ${attempts} attempt(s): ${reason}. ` +
    `Your writing is safe in git and is not lost. The site will serve the ` +
    `previous version of this post until the index catches up. ` +
    `Do NOT save again; the commit already landed and a second save changes nothing. ` +
    `Repair: run the content sync (npm run sync:content -- --remote), or press ` +
    `Sync Ask corpus on /admin/posts, either of which rebuilds this row from the repo.`
  );
}

/**
 * Runs the D1 write, retries it once, and records a divergence if both fail.
 *
 * ## ONE RETRY, NOT MANY
 *
 * The failure this is built for is transient: a D1 timeout, a dropped
 * connection, a momentarily unavailable database. One retry converts the common
 * case into a non-event. A retry loop would not: if the second attempt fails
 * the fault is not transient, and hammering a database that is refusing writes
 * while an operator's HTTP request hangs open makes both problems worse. The
 * repair path is a rebuild from the repo, which is cheap and correct, so
 * failing fast into a recorded divergence beats persisting.
 *
 * ## THE RECORD IS WRITTEN BEFORE THE THROW, and it must not go to D1
 *
 * `recordDivergence` is injected rather than called directly because the store
 * it writes to CANNOT BE D1: D1 is the thing that just failed twice, so writing
 * the record of a D1 failure into D1 is a record that is absent exactly when it
 * is needed. The caller passes a KV writer.
 *
 * **A failure to record does not swallow the original error.** If the recorder
 * throws, the divergence error is still raised, because the operator being told
 * is more important than the status surface knowing.
 *
 * @param {{
 *   write: () => Promise<unknown>,
 *   recordDivergence: (facts: { slug: string, commitSha: string, error: string }) => Promise<unknown>,
 *   slug: string,
 *   commitSha: string,
 *   attempts?: number,
 * }} options
 * @returns {Promise<{ ok: true, attempts: number, retried: boolean }>}
 */
export async function convergeWithRetry({
  write,
  recordDivergence,
  slug,
  commitSha,
  attempts = 2,
}) {
  /** @type {unknown} */
  let last;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await write();
      return { ok: true, attempts: attempt, retried: attempt > 1 };
    } catch (error) {
      last = error;
    }
  }

  const message = divergenceMessage({ slug, commitSha, attempts, cause: last });

  try {
    await recordDivergence({
      slug,
      commitSha,
      error: last instanceof Error ? last.message : String(last ?? "unknown"),
    });
  } catch (recordError) {
    // Reported, never rethrown in place of the real fault. Losing the status
    // entry is bad; replacing the operator's explanation with the failure of
    // the thing that was meant to explain it is worse.
    console.error("failed to record a D1 divergence", recordError);
  }

  const error = new Error(message);
  error.name = DIVERGENCE_ERROR_NAME;
  error.cause = last;
  return Promise.reject(error);
}
